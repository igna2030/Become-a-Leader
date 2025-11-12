import { Partida } from './../../interface/partida';
import { UserService } from './../../service/user.service';
import { Component, inject } from '@angular/core';
import { PokeAPIService } from '../../service/poke-api.service';
import { TeamService } from '../../service/team.service';
import { RankingService } from '../../service/ranking.service';
import { Move } from '../../interface/move';
import { Pokemon } from '../../interface/pokemon';
import { tipos } from '../../interface/tipos';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PartidaService } from '../../service/partida.service';
import { Entrenador } from '../../interface/entrenador';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { MiniPokedexComponent } from "../app-mini-pokedex/pokedex";
import { Items } from '../../interface/items';
import { AudioService } from '../../service/audio-service';

@Component({
  selector: 'app-batalla',
  standalone: true,
  imports: [CommonModule, TranslateModule, MiniPokedexComponent],
  templateUrl: './batalla.component.html',
  styleUrls: ['./batalla.component.css']
})
export class BatallaComponent {
  pokeapi = inject(PokeAPIService);
  teamService = inject(TeamService);
  ps = inject(PartidaService);
  rs = inject(RankingService);
  translate = inject(TranslateService);
  isBossBattle: boolean = false;
  bossMultiplier: number = 1.7;
  turnosParaBoss: number = 5;
  cambioPokemon: boolean = false;
  duelosGanados: number = 0;
  idPartida: string = '';
  partida: Partida | null = null;
  jugador?: Entrenador;
  rival: Pokemon[] = [];
  pokemonJugador?: Pokemon | null = null;
  pokemonRival?: Pokemon | null = null;
  movimientosJugador: Move[] = [];
  mensajeBatalla: string = '';
  movimientosRival: Move[] = [];
  resultado: string = '';
  mostrarModal: boolean = false;
  mensajeModal: string = '';
  UserService = inject(UserService);
  pokemonDebilitados: Pokemon[] = [];
  mostrarSeleccionRevivir: boolean = false;
  mostrarInventario: boolean = false;
  originalEquipoJugador: Pokemon[] = [];
  itemDeRevivirSeleccionado: Items | null = null;
  indiceItemDeRevivir: number = -1;
  audio_service = inject(AudioService)

  healingValues: { [key: string]: number } = {
    'potion': 20,
    "hyper-potion": 200,
    "super-potion": 50,
    //curacion total
    "full-restore": 9999,
    "max-potion": 9999,
    //revives
    "revive": .5,
    "max-revive": 9999,
    "sacred-ash": 9999,
    //bebidas
    "fresh-water": 50,
    "soda-pop": 60,
    "lemonade": 80,
    "moomoo-milk": 100,
    "energy-powder": 50,
    "energy-root": 200,
    "berry-juice": 20
  }

  constructor(private router: Router, private route: ActivatedRoute) { }

  getTranslatedTypeName(typeName: string): Observable<string> {
    return this.pokeapi.getLocalizedTypeName(typeName);
  }

  ngOnInit(): void {
    this.idPartida = localStorage.getItem('token')!;

    if (!this.idPartida) {
      console.error(this.translate.instant('log.errorMissingToken'));
      this.navegarMenu();
      return;
    }

    this.ps.getPartidaByUserId(this.idPartida).subscribe({
      next: (partida) => {
        this.partida = partida;

        if (this.partida) {
          console.log('Partida obtenida:', partida);
          this.jugador = partida?.personaje;
          if (this.jugador) {
            if (!this.jugador.items) {
              this.jugador.items = [];
            }
            this.pokeapi.getItemsById(this.getRandomItem()).subscribe({
              next: (data: Items) => {
                this.jugador!.items?.push(data)
                console.log(data);
              },
              error: (err: Error) => {
                console.log(err)
              },
            })
          }
          else {
            console.log("No se encontro el jugador");
          }
          this.duelosGanados = (this.partida as any).duelosGanados || 0;
          console.log('Duelos Ganados inicializados:', this.duelosGanados);
          console.log('Entrenador obtenido:', this.jugador);
          this.iniciarBatalla();
        } else {
          console.error('Error: Partida no encontrada a pesar de la respuesta exitosa. Redirigiendo.');
          this.navegarMenu();
        }
      },
      error: (error) => {
        console.error('Error al obtener la partida (404 o error de red). Navegando al menú.', error);
        this.navegarMenu();
      }
    })
  }

  obtenerClaseTipoMovimiento(tipo: string): string {
    return tipo.toLocaleLowerCase();
  }

  obtenerUrlSprites(pokemon: Pokemon): Promise<{ front_default: string, back_default: string }> {
    return new Promise((resolve, reject) => {
      this.pokeapi.getSpriteByID(pokemon.id).subscribe({
        next: (data) => {
          resolve({
            front_default: data.front_default,
            back_default: data.back_default
          });
        },
        error: (error: Error) => {
          reject(this.translate.instant('batalla.errorSpriteFetch'));
        }
      });
    });
  }

  async asignarSprites(equipo: Pokemon[] | undefined) {
    for (const element of equipo || []) {
      try {
        const urls = await this.obtenerUrlSprites(element);
        element.backSprite = urls.back_default;
        element.frontSprite = urls.front_default;
      }
      catch {
        console.error(this.translate.instant('log.spriteUrlError'));
      }
    }
  }

  async localizePokemon(pokemon: Pokemon): Promise<void> {
    const cleanSpeciesName = pokemon.especie.toLowerCase().replace(/[\s\.]/g, '-');

    const localizedData = await this.pokeapi.getPokemonDetails(cleanSpeciesName).toPromise();
    if (localizedData?.name) {
      pokemon.especie = localizedData.name;
      pokemon.localizedName = localizedData.name;
    }

    const movePromises = pokemon.movimientos.map(async (move) => {
      const localizedName = await this.pokeapi.getMoveLocalizedName(move.nombre).toPromise();
      if (localizedName) {
        move.nombre = localizedName;
        move.localizedName = localizedName;
      }
    });

    await Promise.all(movePromises);
  }

  async iniciarBatalla() {
    console.log(this.translate.instant('batalla.status.loadingBattle'));

    await this.asignarSprites(this.jugador?.equipo);

    if (this.jugador?.equipo) {
      this.originalEquipoJugador = JSON.parse(JSON.stringify(this.jugador.equipo));
    }

    this.pokemonJugador = this.jugador?.equipo[0];

    if (this.pokemonJugador) {
      await this.localizePokemon(this.pokemonJugador);
    }

    console.log(this.translate.instant('batalla.status.pokemonPlayer'), this.pokemonJugador);

    await this.generarRival();

    this.movimientosJugador = this.pokemonJugador?.movimientos!;
  }

  checkBossBattle(): boolean {
    if (this.duelosGanados > 0 && this.duelosGanados % this.turnosParaBoss === 0) {
      this.isBossBattle = true;
      console.log(this.translate.instant('batalla.status.bossBattle'));
      return true;
    }
    this.isBossBattle = false;
    return false;
  }

  enhancePokemonStats(pokemon: Pokemon): Pokemon {
    if (!this.isBossBattle) return pokemon;

    const enhancedPokemon = {
      ...pokemon,
      estadisticas: { ...pokemon.estadisticas }
    };

    enhancedPokemon.estadisticas.hp = Math.floor(pokemon.estadisticas.hp * this.bossMultiplier);
    enhancedPokemon.estadisticas.atk = Math.floor(pokemon.estadisticas.atk * this.bossMultiplier);
    enhancedPokemon.estadisticas.def = Math.floor(pokemon.estadisticas.def * this.bossMultiplier);
    enhancedPokemon.estadisticas.satk = Math.floor(pokemon.estadisticas.satk * this.bossMultiplier);
    enhancedPokemon.estadisticas.sdef = Math.floor(pokemon.estadisticas.sdef * this.bossMultiplier);
    enhancedPokemon.estadisticas.spd = Math.floor(pokemon.estadisticas.spd * this.bossMultiplier);

    enhancedPokemon.vidaActual = enhancedPokemon.estadisticas.hp;
    return enhancedPokemon;
  }

  generarRival(): Promise<void> {
    console.log(this.translate.instant('batalla.status.generatingRival'));

    const isBoss = this.checkBossBattle();

    return new Promise((resolve, reject) => {
      this.teamService.getPokemons().subscribe(
        {
          next: async (data) => {
            const numRivals = isBoss ? 1 : 6;

            this.rival = [];

            while (this.rival.length < numRivals) {
              let pokemon = data[Math.floor(Math.random() * (data.length - 1)) + 1];
              pokemon.idEntrenador = "rival";

              if (isBoss) {
                pokemon = this.enhancePokemonStats(pokemon);
              }
              this.rival.push(pokemon);
            }

            const localizationPromises = this.rival.map(p => this.localizePokemon(p));
            await Promise.all(localizationPromises);

            await this.asignarSprites(this.rival);

            this.pokemonRival = this.rival[0];
            this.movimientosRival = this.pokemonRival.movimientos!;

            console.log(this.translate.instant('batalla.status.pokemonRival'), this.pokemonRival);

            if (isBoss) {
              this.translate.get('batalla.bossEngagedMsg', { name: this.transformarPrimeraLetra(this.pokemonRival.especie) }).subscribe(msg => {
                this.mostrarMensajeBatalla(msg);
              });
            } else {
              this.mostrarMensajeBatalla(`${this.translate.instant('batalla.rivalAppeared')} ${this.transformarPrimeraLetra(this.pokemonRival.especie)}.`);
            }

            resolve();
          },
          error: (error: Error) => {
            console.log(this.translate.instant('batalla.status.errorRivalLoad'), error);
            reject(error);
          }
        })
    });
  }

  batalla(movimientoSeleccionado: Move): void {
    let atacante: Pokemon;
    let defensor: Pokemon;
    let movimientoAtacante: Move;
    let chequearTurnoDefensor: string;
    console.log(this.translate.instant('batalla.status.loadingBattle'));
    if (this.pokemonJugador!.estadisticas.spd >= this.pokemonRival!.estadisticas.spd) {
      atacante = this.pokemonJugador!;
      defensor = this.pokemonRival!;
      chequearTurnoDefensor = this.pokemonRival!.id;
      movimientoAtacante = movimientoSeleccionado;
      console.log(this.translate.instant('batalla.status.attackingPlayer'));
      console.log(this.translate.instant('batalla.status.defenderId'), chequearTurnoDefensor);
    } else {
      atacante = this.pokemonRival!;
      defensor = this.pokemonJugador!;
      chequearTurnoDefensor = this.pokemonJugador!.id;
      movimientoAtacante = this.generarMovimientoRival();
      console.log(this.translate.instant('batalla.status.attackingRival'));
      console.log(this.translate.instant('batalla.status.defenderId'), chequearTurnoDefensor);
    }
    this.calcularAtaque(movimientoAtacante, atacante, defensor);
    console.log(this.translate.instant('batalla.status.originalDefenderId'), defensor.id);
    defensor = this.verificarCambio(defensor);
    console.log(this.translate.instant('batalla.status.newDefenderId'), defensor.id);

    setTimeout(() => {
      if (chequearTurnoDefensor === defensor.id) {
        console.log(this.translate.instant('batalla.status.defenderStanding'));
        if (defensor === this.pokemonJugador) {
          movimientoAtacante = movimientoSeleccionado;
        } else {
          movimientoAtacante = this.generarMovimientoRival();
        }

        this.calcularAtaque(movimientoAtacante, defensor, atacante);

        this.verificarCambio(atacante);
      }
    }, 2000)
  }

  generarMovimientoRival(): Move {
    const movimientosPosibles = this.pokemonRival?.movimientos || [];
    const indiceAleatorio = Math.floor(Math.random() * movimientosPosibles.length);
    return movimientosPosibles[indiceAleatorio];
  }
  realizarAtaque2(movimiento: Move, atacante: Pokemon, defensor: Pokemon): void {
    let danio = 0;

    if (movimiento.clase === 'Fisico') {
      danio = Math.max(atacante.estadisticas.atk - defensor.estadisticas.def, 1);
    } else if (movimiento.clase === 'Especial') {
      danio = Math.max(atacante.estadisticas.satk - defensor.estadisticas.sdef, 1);
    }

    defensor.vidaActual = Math.max(defensor.vidaActual - danio, 0);

    console.log(`${atacante.especie} ${this.translate.instant('batalla.usedMove')} ${defensor.especie} con ${movimiento.nombre} causando ${danio} de daño.`);
  }

  verificarCambio(defensor: Pokemon): Pokemon {
    if (defensor.vidaActual <= 0) {
      this.mensajeBatalla = `${this.transformarPrimeraLetra(defensor.especie)} ${this.translate.instant('batalla.isDefeated')}`;
      console.log(this.mensajeBatalla);

      if (defensor.idEntrenador === this.pokemonJugador?.idEntrenador) {
        const faintedPokemonIndex = this.jugador!.equipo.findIndex(p => p.id === defensor.id);
        if (faintedPokemonIndex !== -1) {
          const fainted = this.jugador!.equipo.splice(faintedPokemonIndex, 1)[0];
          this.pokemonDebilitados.push(fainted)
        }

        if (this.jugador?.equipo.length === 0) {
          console.log(this.translate.instant('batalla.status.playerTeamDefeated'));
          this.finalizarBatalla(false);
          this.duelosGanados = 0;
        }
        if (this.jugador!.equipo.length > 0) {
          this.pokemonJugador = this.jugador!.equipo[0];
          this.movimientosJugador = this.pokemonJugador.movimientos!;
          defensor = this.pokemonJugador;
          this.localizePokemon(defensor);
        }
      } else {
        this.rival.shift();
        if (this.rival.length === 0) {
          console.log(this.translate.instant('batalla.status.rivalTeamDefeated'));

          if (this.isBossBattle) {
            this.isBossBattle = false;
          }

          this.finalizarBatalla(true);
        }
        if (this.rival.length > 0) {
          this.pokemonRival = this.rival[0];
          this.movimientosRival = this.pokemonRival.movimientos!;
          defensor = this.pokemonRival;
          this.localizePokemon(defensor);
        }
      }
    }
    return defensor;
  }

  calcularAtaque(movimiento: Move, atacante: Pokemon, defensor: Pokemon) {
    console.log(`${this.transformarPrimeraLetra(atacante.especie)} ${this.translate.instant('batalla.status.performingMove')} ${this.transformarPrimeraLetra(movimiento.nombre)}`);
    const factor = this.calcularEfectividad(movimiento.tipo, defensor.tipos);

    if (movimiento.originalName) { 
        this.audio_service.playMoveSound(movimiento.originalName);
    }
    const nivel = 50;
    const potencia = movimiento.potencia || 0;

    let ataqueStat = movimiento.clase === 'Fisico' ? atacante.estadisticas.atk : atacante.estadisticas.satk;
    let defensaStat = movimiento.clase === 'Fisico' ? defensor.estadisticas.def : defensor.estadisticas.sdef;

    defensaStat = defensaStat === 0 ? 1 : defensaStat;

    let danio = 0;
    if (movimiento.clase !== 'Estado' && potencia > 0) {
      danio = Math.floor(
        (((2 * nivel / 5 + 2) * potencia * (ataqueStat / defensaStat)) / 50 + 2) * factor
      );
      danio = Math.max(1, danio);
    } else if (movimiento.clase === 'Estado') {
      danio = 0;
      console.log(`El movimiento ${movimiento.nombre} es de estado y no causa daño.`);
    }

    defensor.vidaActual -= danio;


    let efectoMensaje = '';
    if (factor > 1) {
      efectoMensaje = this.translate.instant('batalla.superEffective');
    } else if (factor === 0) {
      efectoMensaje = this.translate.instant('batalla.noEffect');
    } else if (factor < 1) {
      efectoMensaje = this.translate.instant('batalla.notVeryEffective');
    }

    const baseAtaque = `${this.transformarPrimeraLetra(atacante.especie)} ${this.translate.instant('batalla.usedMove')} ${this.transformarPrimeraLetra(movimiento.nombre)}.`;

    let mensajeAtaque = baseAtaque + (efectoMensaje ? ` ${efectoMensaje}` : '');

    this.mostrarMensajeBatalla(mensajeAtaque);

    if (defensor.vidaActual < 0) {
      defensor.vidaActual = 0;
      const faintedMsg = `${this.transformarPrimeraLetra(defensor.especie)} ${this.translate.instant('batalla.fainted')}`;
      this.mostrarMensajeBatalla(mensajeAtaque + ` ${faintedMsg}`);
    }
  }

  mostrarMensajeBatalla(mensaje: string) {
    this.mensajeBatalla = mensaje;
  }

  calcularEfectividad(tipoAtaque: string, tiposDefensor: string[]): number {
    console.log(this.translate.instant('batalla.status.calculatingEffectiveness'));
    console.log(this.translate.instant('batalla.status.attackType'), tipoAtaque);
    let efectividadTotal = 1;

    const tipoAtacante = tipos.find(t => t.name === tipoAtaque.toLowerCase());
    if (!tipoAtacante) return efectividadTotal;

    for (const tipoDefensor of tiposDefensor) {
      console.log(this.translate.instant('batalla.status.defenderType'), tipoDefensor);
      const efectividad = tipoAtacante.efectivity.find(([tipo, _]) => tipo === tipoDefensor.toLowerCase());
      if (efectividad) {
        efectividadTotal *= efectividad[1];
      } else {
        efectividadTotal *= 1;
      }
    }
    console.log(this.translate.instant('batalla.status.effectiveness'), efectividadTotal);
    return efectividadTotal;
  }

  pokemonJugadorRestantes(): number {
    return this.jugador?.equipo.filter(pokemon => pokemon.vidaActual > 0).length || 0;
  }

  pokemonRivalRestantes(): number {
    return this.rival?.filter(pokemon => pokemon.vidaActual > 0).length || 0;
  }

  transformarPrimeraLetra(nombre: string): string {
    if (!nombre) return nombre;
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }

  finalizarBatalla(ganador: boolean) {
    let puntajeNuevo = 0;

    if (!this.partida || !this.partida.id || !this.jugador) {
      console.error('Error: Objeto Partida o Partida ID no disponibles. No se puede actualizar el puntaje.');
      this.resultado = this.translate.instant('batalla.defeatTitle');
      this.mensajeModal = this.translate.instant('batalla.errorGameUpdate');
      this.mostrarModal = true;
      return;
    }

    const partidaId = this.partida.id;
    const nombreJugador = this.jugador.nombre;

    if (ganador) {
      const puntosGanados = this.isBossBattle ? 3 : 1;
      puntajeNuevo = (this.partida.puntuacion ?? 0) + puntosGanados;

      this.duelosGanados++;

      this.resultado = this.translate.instant('batalla.title');

      this.translate.get('batalla.victoryMsg', { puntajeNuevo: puntajeNuevo, puntosGanados: puntosGanados }).subscribe(msg => {
        this.mensajeModal = msg;
        this.mostrarModal = true;
      });


      let id = this.getRandomItem();
      this.pokeapi.getItemsById(id).subscribe({
        next: (value: Items) => {
          this.jugador?.items?.push(value);

        },
        error: (err: Error) => {
          console.log(err)
        },
      })
      this.ps.actualizarPuntaje(partidaId, { puntuacion: puntajeNuevo, duelosGanados: this.duelosGanados } as any).subscribe({
        next: (response) => {
          console.log(this.translate.instant('log.scoreUpdated'), response);
          this.partida!.puntuacion = puntajeNuevo;
          (this.partida as any).duelosGanados = this.duelosGanados;
          this.continuarBatalla();
        },
        error: (error: Error) => {
          console.error(this.translate.instant('log.scoreUpdateError'), error);
        }
      });

      this.isBossBattle = false;

    } else {
      const ranking = { nombre: '', usuario: '', puntaje: 0 };
      puntajeNuevo = this.partida.puntuacion ?? 0;
      this.resultado = this.translate.instant('batalla.defeatTitle');

      this.translate.get('batalla.defeatMsg', { puntajeNuevo: puntajeNuevo }).subscribe(msg => {
        this.mensajeModal = msg;
        this.mostrarModal = true;
      });

      console.log(nombreJugador);
      console.log(partidaId);
      ranking!.nombre = nombreJugador;
      ranking!.usuario = partidaId;
      ranking!.puntaje = puntajeNuevo;

      this.rs.postRanking(ranking!).subscribe({
        next: (response) => {
          console.log(this.translate.instant('log.rankingUpdated'), response);
        },
        error: (error: Error) => {
          console.error(this.translate.instant('log.rankingUpdateError'), error);
        }
      });

      this.ps.eliminarPartida(partidaId).subscribe({
        next: (response) => {
          console.log(this.translate.instant('log.gameDeleted'), response);
        },
        error: (error: Error) => {
          console.error(this.translate.instant('log.gameDeleteError'), error);
        }
      });
    }
  }

  async continuarBatalla() {
    if (!this.jugador) {
      console.error('continuarBatalla: jugador no definido, no se puede restaurar el equipo.');
      return;
    }

    if (this.originalEquipoJugador && this.originalEquipoJugador.length) {
      this.jugador.equipo = this.originalEquipoJugador.map(p => {
        const nuevo: Pokemon = {
          ...p,
          estadisticas: { ...p.estadisticas },
          movimientos: p.movimientos ? p.movimientos.map(m => ({ ...m })) : [],
          id: p.id,
          idEntrenador: p.idEntrenador,
          especie: p.especie,
          vidaActual: p.estadisticas.hp,
          frontSprite: p.frontSprite,
          backSprite: p.backSprite,
          localizedName: p.localizedName
        } as any;
        return nuevo;
      });

      this.jugador.equipo.forEach(p => {
        p.vidaActual = p.estadisticas.hp;
      });

      this.pokemonJugador = this.jugador.equipo[0];
      if (this.pokemonJugador) {
        await this.localizePokemon(this.pokemonJugador);
        await this.asignarSprites(this.jugador.equipo);
        this.movimientosJugador = this.pokemonJugador.movimientos!;
      }
    } else {
      if (this.jugador.equipo) {
        this.jugador.equipo.forEach(p => {
          p.vidaActual = p.estadisticas.hp;
        });
        this.pokemonJugador = this.jugador.equipo[0];
        if (this.pokemonJugador) {
          await this.localizePokemon(this.pokemonJugador);
          this.movimientosJugador = this.pokemonJugador.movimientos!;
        }
      }
    }

    this.pokemonRival = null;
    this.rival = [];
    this.mensajeBatalla = this.translate.instant('batalla.status.preparingNextBattle');
  }


  cerrarModal() {
    const isWin = this.resultado === this.translate.instant('batalla.title');

    this.mostrarModal = false;
    this.resultado = '';
    this.mensajeModal = '';

    if (isWin) {
      this.generarRival();
    }
    else {
      this.navegarMenu();
    }
  }

  navegarMenu() {
    this.router.navigate(['/menu']);
  }

  logout() {
    this.UserService.logout();
    this.router.navigate(['']);
  }


  getRandomItem() {
    const healingIds: number[] = [17, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 34, 35, 43, 44];
    const randomIndex = Math.floor(Math.random() * healingIds.length);
    return healingIds[randomIndex];

  }


  ejecutarCuracionHP(itemUsado: Items, itemIndex: number): void {
    if (!this.pokemonJugador || this.pokemonJugador.vidaActual === this.pokemonJugador.estadisticas.hp) {
      this.mostrarMensajeBatalla(this.translate.instant('batalla.status.alreadyFullHP'));
      return;
    }

    const itemName = itemUsado.name.toLowerCase();
    let curacionValor: number = this.healingValues[itemName] || 0;

    let curacionAplicada: number;

    if (curacionValor === 9999) {
      curacionAplicada = this.pokemonJugador.estadisticas.hp - this.pokemonJugador.vidaActual;
    } else {
      curacionAplicada = curacionValor;
    }

    const vidaAntes = this.pokemonJugador.vidaActual;
    const vidaDeseada = vidaAntes + curacionAplicada;

    this.pokemonJugador.vidaActual = Math.min(
      vidaDeseada,
      this.pokemonJugador.estadisticas.hp
    );

    const vidaRestaurada = this.pokemonJugador.vidaActual - vidaAntes;

    this.mostrarMensajeBatalla(
      `${this.transformarPrimeraLetra(this.pokemonJugador.especie)} ${this.translate.instant('batalla.usedItem')} ${this.transformarPrimeraLetra(itemUsado.name)}. ${this.translate.instant('batalla.healed')} ${vidaRestaurada} ${this.translate.instant('batalla.hp')}`
    );

    this.jugador!.items!.splice(itemIndex, 1);

    setTimeout(() => {
      const movimientoRival = this.generarMovimientoRival();
      this.calcularAtaque(movimientoRival, this.pokemonRival!, this.pokemonJugador!);
      this.verificarCambio(this.pokemonJugador!);
    }, 2000);
  }

  iniciarSeleccionRevive(itemUsado: Items): void {
    if (this.pokemonDebilitados.length === 0) {
      this.mostrarMensajeBatalla(this.translate.instant('batalla.status.noFainted'));
      return;
    }
    this.mostrarSeleccionRevivir = true;
    this.mostrarMensajeBatalla(
      `${this.translate.instant('batalla.selectTargetFor')} ${this.transformarPrimeraLetra(itemUsado.name)}.`
    );
  }

  ejecutarRevivir(pokemonIndex: number): void {
    const itemUsado = this.itemDeRevivirSeleccionado;
    const reviveItemIndex = this.indiceItemDeRevivir;

    this.mostrarSeleccionRevivir = false;

    if (!itemUsado || reviveItemIndex === -1 || this.pokemonDebilitados.length <= pokemonIndex) {
      this.mostrarMensajeBatalla(this.translate.instant('batalla.error.invalidAction'));
      return;
    }

    const itemName = itemUsado.name.toLowerCase();
    const pokemonRevivido = this.pokemonDebilitados[pokemonIndex];

    let hpRevivido: number;
    if (itemName === 'max-revive' || itemName === 'sacred-ash') {
      hpRevivido = pokemonRevivido.estadisticas.hp;
    } else {
      hpRevivido = Math.floor(pokemonRevivido.estadisticas.hp / 2);
    }

    const [pokemonMovido] = this.pokemonDebilitados.splice(pokemonIndex, 1);

    pokemonMovido.vidaActual = hpRevivido;
    this.jugador!.equipo.push(pokemonMovido);

    this.mostrarMensajeBatalla(
      `${this.transformarPrimeraLetra(pokemonRevivido.especie)} ${this.translate.instant('batalla.revived')} ${this.transformarPrimeraLetra(itemUsado.name)} con ${hpRevivido} ${this.translate.instant('batalla.hp')}.`
    );

    this.jugador!.items!.splice(reviveItemIndex, 1);

    this.itemDeRevivirSeleccionado = null;
    this.indiceItemDeRevivir = -1;

    setTimeout(() => {
      const movimientoRival = this.generarMovimientoRival();
      this.calcularAtaque(movimientoRival, this.pokemonRival!, this.pokemonJugador!);
      this.verificarCambio(this.pokemonJugador!);
    }, 2000);
  }





  ejecutarSacredAsh(itemUsado: Items, itemIndex: number): void {
    if (this.pokemonDebilitados.length === 0) {
      this.mostrarMensajeBatalla(this.translate.instant('batalla.status.noFainted'));
      return;
    }

    while (this.pokemonDebilitados.length > 0) {
      const pokemon = this.pokemonDebilitados.shift()!;
      pokemon.vidaActual = pokemon.estadisticas.hp;
      this.jugador!.equipo.push(pokemon);
    }

    this.mostrarMensajeBatalla(
      `${this.translate.instant('batalla.allFaintedRevived')} ${this.transformarPrimeraLetra(itemUsado.name)}.`
    );

    this.jugador!.items!.splice(itemIndex, 1);
    setTimeout(() => {
      const movimientoRival = this.generarMovimientoRival();
      this.calcularAtaque(movimientoRival, this.pokemonRival!, this.pokemonJugador!);
      this.verificarCambio(this.pokemonJugador!);
    }, 2000);
  }




  usarItemPorIndice(index: number): void {
    const itemUsado: Items = this.jugador!.items![index];
    const itemName = itemUsado.name.toLowerCase();

    this.mostrarInventario = false;

    if (itemName === 'revive' || itemName === 'max-revive') {

      if (this.pokemonDebilitados.length === 0) {
        this.mostrarMensajeBatalla(this.translate.instant('batalla.status.noFainted'));
        return;
      }
      this.itemDeRevivirSeleccionado = itemUsado;
      this.indiceItemDeRevivir = index;

      this.mostrarSeleccionRevivir = true;
      return;
    }

    if (itemName === 'sacred-ash') {
      this.ejecutarSacredAsh(itemUsado, index);
      return;
    }

    this.ejecutarCuracionHP(itemUsado, index);
  }
  

}



