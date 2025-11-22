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
import { Stats } from '../../interface/stats';
@Component({
  selector: 'app-batalla',
  standalone: true,
  imports: [CommonModule, TranslateModule, MiniPokedexComponent],
  templateUrl: './batalla.component.html',
  styleUrls: ['./batalla.component.css']
})
export class BatallaComponent {
  //Servicios
  pokeapi = inject(PokeAPIService);
  teamService = inject(TeamService);
  ps = inject(PartidaService);
  rs = inject(RankingService);
  translate = inject(TranslateService);
  audio_service = inject(AudioService);
  UserService = inject(UserService);

  bgmVolume = this.audio_service.getBGMVolume();
  sfxVolume = this.audio_service.getsfxVolume();
  
  //pelea con jefe
  isBossBattle: boolean = false;
  bossStatMultiplier: number = 2;   // Para Vida y Velocidad
  bossDamageMultiplier: number = 2; // Para Ataque y Ataque Especial
  bossDefenseMultiplier = 1.5;
  turnosParaBoss: number = 5;
  duelosGanados: number = 0;
  
  //interfaces
  idPartida: string = '';
  partida: Partida | null = null;
  jugador?: Entrenador;
  rival: Pokemon[] = [];
  pokemonJugador?: Pokemon | null = null;
  pokemonRival?: Pokemon | null = null;
  movimientosJugador: Move[] = [];
  movimientosRival: Move[] = [];
  
  //mensajes
  mensajeBatalla: string = '';
  resultado: string = '';
  mostrarModal: boolean = false;
  mensajeModal: string = '';
  
  //lista de pokemon debilitados
  pokemonDebilitados: Pokemon[] = [];
  originalEquipoJugador: Pokemon[] = [];
  
  //inventario
  mostrarSeleccionRevivir: boolean = false;
  mostrarInventario: boolean = false;
  itemDeRevivirSeleccionado: Items | null = null;
  indiceItemDeRevivir: number = -1;
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
  //animacion movimiento pokemon
  pokemonAtacanteId: string | null = null;

  mostrarSeleccionEquipo: boolean = false;
  modoSeleccion: 'cambio' | 'curacion' | null = null; // Para saber qué hacer al hacer click

  // Variables temporales para cuando se elige curar
  itemCuracionSeleccionado: Items | null = null;
  indiceItemCuracion: number = -1;

  constructor(private router: Router, private route: ActivatedRoute) { }


  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

ngOnInit(): void {
    // 1. Encuentra el ID de la partida
    this.idPartida = localStorage.getItem('token')!;

    if (!this.idPartida) {
      console.error(this.translate.instant('log.errorMissingToken'));
      this.navegarMenu();
      return;
    }

    // 2. Suscribirse a la partida
    this.ps.getPartidaByUserId(this.idPartida).subscribe({
      next: async (partida) => {
        this.partida = partida;

        if (this.partida && this.partida.personaje) {
          console.log('Partida obtenida:', partida);
          this.jugador = this.partida.personaje;

          // TRADUCIR INVENTARIO EXISTENTE (Base de Datos) 
          if (this.jugador.items && this.jugador.items.length > 0) {
            console.log('Traduciendo items guardados...');
            // Esperamos a que todos los items viejos se traduzcan al idioma actual
            const promesasTraduccion = this.jugador.items.map(item => 
              this.actualizarIdiomaItemExistente(item)
            );
            await Promise.all(promesasTraduccion);
          } else {
            // Si no existe el array, lo inicializamos
            this.jugador.items = [];
          }

          //  GENERAR Y AGREGAR NUEVO ITEM RANDOM 
          const idNuevoItem = this.getRandomItem();
          
          // Pedimos el item a la PokeAPI
          this.pokeapi.getItemsById(idNuevoItem).subscribe({
            next: async (nuevoItem: Items) => {
              
              // Traducimos el NUEVO item antes de meterlo a la bolsa
              await this.localizeItem(nuevoItem, idNuevoItem);
              
              // Lo agregamos al inventario
              this.jugador?.items?.push(nuevoItem);
              console.log('Nuevo item random agregado y traducido:', nuevoItem.localizedName);
              
              // Actualizamos logs
              console.log('Ítems totales:', this.jugador!.items!.length);

              // Configuramos stats de partida
              this.duelosGanados = (this.partida as any).duelosGanados || 0;
              
              // INICIAR BATALLA 
              // Solo iniciamos aquí, asegurando que ya tenemos items viejos traducidos + item nuevo traducido
              this.iniciarBatalla();
            },
            error: (err: Error) => {
              console.error('Error al obtener el item random:', err);
              // Si falla la API del item, iniciamos la batalla igual para no trabar el juego
              this.iniciarBatalla();
            }
          });

        } else {
          console.error('Error: Partida o Jugador no encontrados.');
          this.navegarMenu();
        }
      },
      error: (error) => {
        console.error('Error al obtener la partida (404 o error de red).', error);
        this.navegarMenu();
      }
    });
  }

  ngOnDestroy(): void {
    //quita la música
    this.audio_service.stopBGM();
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


  // Agrega este método en tu clase BatallaComponent
async localizeItem(item: Items, id: number): Promise<void> {
  try {
    // Obtenemos el idioma actual (por defecto 'es' si no existe)
    const language = this.translate.currentLang || 'es';

    // Hacemos una petición directa a la API para obtener los detalles crudos (nombres y descripciones en todos los idiomas)
    // Nota: Usamos fetch aquí para asegurar que obtenemos la data cruda sin depender de cómo esté configurado tu servicio
    const response = await fetch(`https://pokeapi.co/api/v2/item/${id}/`);
    const data = await response.json();

    // 1. Buscar la descripción en el idioma actual
    const flavorTextEntry = data.flavor_text_entries.find((entry: any) => entry.language.name === language);
    if (flavorTextEntry) {
      // Usamos tu función limpiarDescripcion para formatearlo bien
      item.description = this.limpiarDescripcion(flavorTextEntry.text);
    }

    // 2. Buscar el nombre localizado (ej: "Potion" -> "Poción")
    const nameEntry = data.names.find((entry: any) => entry.language.name === language);
    if (nameEntry) {
      item.localizedName = nameEntry.name;
    }

  } catch (error) {
    console.error('Error al localizar el item antes de guardar:', error);
  }
}

  //esta funcion sirve para localizar los pokemon segun el currentLang()
  async localizePokemon(pokemon: Pokemon): Promise<void> {
    //pone el nombre de los pokemon todo en minusculas 
    // y cambia los espacios puntos o barras por - para seguir la convencion de la pokeapi
    const cleanSpeciesName = pokemon.especie.toLowerCase().replace(/[\s\.]/g, '-');


    //consigue los datos de los pokemon y espera la promise
    const localizedData = await this.pokeapi.getPokemonDetails(cleanSpeciesName).toPromise();
    //si encuentra la forma localizada la pasa
    if (localizedData?.name) {
      pokemon.especie = localizedData.name;
      pokemon.localizedName = localizedData.name;
    }

    //consigue los movimientos
    const movePromises = pokemon.movimientos.map(async (move) => {
      if (!move.originalName) {
        move.originalName = move.nombre;
      }
      const localizedName = await this.pokeapi.getMoveLocalizedName(move.originalName).toPromise();
      //los traduce si existen
      if (localizedName) {
        move.nombre = localizedName;
        move.localizedName = localizedName;
      }
      //traduce el tipo del movimiento
      if (move.tipo) {
        const localizedType = await this.pokeapi.getLocalizedTypeName(move.tipo).toPromise();
        (move as any).localizedtype = localizedType || this.transformarPrimeraLetra(move.tipo);
      }
    });

    //espera a que se completen las promesas
    await Promise.all(movePromises);
  }
  async iniciarBatalla() {
    console.log(this.translate.instant('batalla.status.loadingBattle'));

    // 1. COMPROBAR SI TOCA JEFE PRIMERO
    this.checkBossBattle();

    // 2. ELEGIR MÚSICA SEGÚN EL RESULTADO
    this.audio_service.resumeContext();
    if (this.isBossBattle) {
      console.log('Reproduciendo música de JEFE');
      this.audio_service.playBGM('bossBattle');
    } else {
      console.log('Reproduciendo música NORMAL');
      this.audio_service.playBGM('battleBGM');
    }


    //espera a que se asignen los sprites
    await this.asignarSprites(this.jugador?.equipo);
    if (this.jugador?.equipo) {
      this.originalEquipoJugador = JSON.parse(JSON.stringify(this.jugador.equipo));
    }
    //si el array existe es el primero del jugador
    this.pokemonJugador = this.jugador?.equipo[0];

    //si existe el pokemon lo localiza
    if (this.pokemonJugador) {
      await this.localizePokemon(this.pokemonJugador);
      //pasa la url del sonido de invocación
      const cryUrl = this.pokemonJugador.cryUrl;
      //si existe lo activa
      if (cryUrl) {
        await this.audio_service.playDynamicSound(cryUrl);
      }
    }

    //muestra el pokemon del jugador
    console.log(this.translate.instant('batalla.status.pokemonPlayer'), this.pokemonJugador);

    //genera el rival
    await this.generarRival();

    //muestra los movimientos del jugador
    this.movimientosJugador = this.pokemonJugador?.movimientos!;
  }

  checkBossBattle(): boolean {
    //cada 5 duelos hay una pelea de jefe
    if (this.duelosGanados > 0 && this.duelosGanados % this.turnosParaBoss === 0) {
      this.isBossBattle = true;
      console.log(this.translate.instant('batalla.status.bossBattle'));
      return true;
    }
    this.isBossBattle = false;
    return false;
  }

  enhancePokemonStats(pokemon: Pokemon): Pokemon {
    // Si no es pelea de jefe simplemente devuelve el pokemon original
    if (!this.isBossBattle) { return pokemon; }

    // Creamos una copia del pokemon para no afectar al original de la "base de datos"
    const enhancedPokemon = {
      ...pokemon,
      estadisticas: { ...pokemon.estadisticas }
    };

    // --- MULTIPLICADOR DE ESTADÍSTICAS GENERALES (X5) ---
    // Vida (HP), Defensa, Defensa Especial y Velocidad
    enhancedPokemon.estadisticas.hp = Math.floor(pokemon.estadisticas.hp * this.bossStatMultiplier);
    enhancedPokemon.estadisticas.def = Math.floor(pokemon.estadisticas.def * this.bossDefenseMultiplier);
    enhancedPokemon.estadisticas.sdef = Math.floor(pokemon.estadisticas.sdef * this.bossStatMultiplier);
    enhancedPokemon.estadisticas.spd = Math.floor(pokemon.estadisticas.spd * this.bossStatMultiplier);

    // --- MULTIPLICADOR DE DAÑO (X3) ---
    // Ataque Físico y Ataque Especial
    enhancedPokemon.estadisticas.atk = Math.floor(pokemon.estadisticas.atk * this.bossDamageMultiplier);
    enhancedPokemon.estadisticas.satk = Math.floor(pokemon.estadisticas.satk * this.bossDamageMultiplier);

    // IMPORTANTE: Actualizar la vida actual al nuevo máximo de HP
    enhancedPokemon.vidaActual = enhancedPokemon.estadisticas.hp;

    console.log('Jefe Generado con Stats X5 y Daño X3:', enhancedPokemon.estadisticas);

    return enhancedPokemon;
  }

  async generarRival(): Promise<void> {
    //muestra que genera el rival
    console.log(this.translate.instant('batalla.status.generatingRival'));

    // Usamos el valor ya calculado en iniciarBatalla
    const isBoss = this.isBossBattle;
    //si es jefe solo crea un jefe
    const numRivals = isBoss ? 1 : 6;

    try {
      this.rival = [];


      //si es jefe solo se crea uno, en el otro caso se generan 6
      while (this.rival.length < numRivals) {
        let randomId: number;
        //crea un id random 
        randomId = Math.floor(Math.random() * 898) + 1;
        //agarra al pokemon de la pokeapi teniendo el mismo id
        let pokemon = await this.crearPokemonDesdeApi(randomId);
        if (isBoss) {
          //si es jefe lo genera con las estadisticas mejoradas
          pokemon = this.enhancePokemonStats(pokemon);
        }
        //pushea el pokemon en el array
        this.rival.push(pokemon);
      }
      //espera a que se le asignen los sprites
      await this.asignarSprites(this.rival);

      this.pokemonRival = this.rival[0];
      this.movimientosRival = this.pokemonRival.movimientos!;
      //aplica el sonido de invocación del pokemon rival
      const cryUrl = this.pokemonRival.cryUrl;
      if (cryUrl) {
        await this.audio_service.playDynamicSound(cryUrl);
      }
      //muestra el nombre del pokemon del rival
      console.log(this.translate.instant('batalla.status.pokemonRival'), this.pokemonRival);

      //si es jefe muestra un mensaje especial aclarando que es un jefe
      //si no simplemente muestra el mensaje que aparecio un rival 
      if (isBoss) {
        this.translate.get('batalla.bossEngagedMsg', { name: this.transformarPrimeraLetra(this.pokemonRival.especie) }).subscribe(msg => {
          this.mostrarMensajeBatalla(msg);
        });
      } else {
        this.mostrarMensajeBatalla(`${this.translate.instant('batalla.rivalAppeared')} ${this.transformarPrimeraLetra(this.pokemonRival.especie)}.`);
      }

    } catch (error) {
      console.error(this.translate.instant('batalla.status.errorRivalLoad'), error);
      this.mostrarMensajeBatalla(this.translate.instant('batalla.status.errorRivalLoad'));
      await this.delay(3000);
      this.navegarMenu();
    }
  }

  private async crearPokemonDesdeApi(id: number): Promise<Pokemon> {
    const apiData = await this.pokeapi.getPokemonDetails(id).toPromise();

    const nivel = 100;
    const ivs = this.generateIVs();
    const estadisticas: Stats = { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 };

    apiData.stats.forEach((s: any) => {
      const baseStat = s.base_stat;
      const ev = this.generateEV(1, 84);
      switch (s.stat.name) {
        case 'hp':
          estadisticas.hp = this.calculateStats(baseStat, ivs.hp, ev, nivel, true);
          break;
        case 'attack':
          estadisticas.atk = this.calculateStats(baseStat, ivs.atk, ev, nivel, false);
          break;
        case 'defense':
          estadisticas.def = this.calculateStats(baseStat, ivs.def, ev, nivel, false);
          break;
        case 'special-attack':
          estadisticas.satk = this.calculateStats(baseStat, ivs.satk, ev, nivel, false);
          break;
        case 'special-defense':
          estadisticas.sdef = this.calculateStats(baseStat, ivs.sdef, ev, nivel, false);
          break;
        case 'speed':
          estadisticas.spd = this.calculateStats(baseStat, ivs.spd, ev, nivel, false);
          break;
      }
    });

    const tipos: string[] = apiData.types.map((t: any) => t.type.name);


    const allMoveNames: string[] = apiData.moves.map((m: any) => m.move.name);
    const moveDataPromises = allMoveNames.map(moveName =>
      this.pokeapi.getMoveByName(moveName).toPromise().catch(e => null)
    );

    const allMoveData = (await Promise.all(moveDataPromises)).filter(m =>
      m != null && m.damage_class != null
    );

    const attackMovesData = allMoveData.filter(m =>
      m.damage_class.name !== 'status' && (m.power || 0) > 0
    );

    const scoredMoves = attackMovesData.map(moveData => {
      let score = moveData.power || 0;

      if (tipos.includes(moveData.type.name)) {
        score += 20;
      }
      return { score, moveData };
    });

    scoredMoves.sort((a, b) => b.score - a.score);

    const viableMovePool = scoredMoves.slice(0, 8);

    const shuffledViableMoves = [...viableMovePool].sort(() => 0.5 - Math.random());

    const mejoresMovimientosData = shuffledViableMoves.slice(0, 4).map(sm => sm.moveData);

    const movimientos: Move[] = [];
    for (const moveData of mejoresMovimientosData) {
      let claseMovimiento: string;
      if (moveData.damage_class.name === 'physical') {
        claseMovimiento = 'Fisico';
      } else {
        claseMovimiento = 'Especial';
      }

      const move: Move = {
        nombre: moveData.name,
        originalName: moveData.originalSlug,
        tipo: moveData.type.name,
        clase: claseMovimiento,
        potencia: moveData.power || 0,
        precision: moveData.accuracy || 100,
        pp: moveData.pp || 10,
        localizedName: moveData.name,
        localizedtype: await this.pokeapi.getLocalizedTypeName(moveData.type.name).toPromise()
      };
      movimientos.push(move);
    }

    const pokemon: Pokemon = {
      id: apiData.id.toString(),
      especie: apiData.name,
      localizedName: apiData.name,
      tipos: tipos,
      nivel: nivel,
      estadisticas: estadisticas,
      vidaActual: estadisticas.hp,
      movimientos: movimientos,
      idEntrenador: "rival",
      cryUrl: apiData.cryUrl,
    };

    return pokemon;
  }
  private generateIVs(): Stats {
    const IV: Stats =
    {
      hp: Math.floor(Math.random() * 32),
      atk: Math.floor(Math.random() * 32),
      def: Math.floor(Math.random() * 32),
      satk: Math.floor(Math.random() * 32),
      sdef: Math.floor(Math.random() * 32),
      spd: Math.floor(Math.random() * 32),
    };
    return IV;
  }

  private calculateStats(base: number, iv: number, ev: number, level: number, isHP = false): number {
    if (isHP) {
      return Math.floor((((2 * base + iv + (ev / 4)) * level) / 100) + level + 10);
    } else {
      return Math.floor((((2 * base + iv + (ev / 4)) * level) / 100) + 5);
    }
  }

  private generateEV(min: number, max: number): number {
    return Math.round(Math.floor(Math.random() * (max - min + 1)) + min);
  }


  async batalla(movimientoSeleccionado: Move): Promise<void> {
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

    await this.calcularAtaque(movimientoAtacante, atacante, defensor);
    await this.delay(100);

    defensor = await this.verificarCambio(defensor);
    console.log(this.translate.instant('batalla.status.newDefenderId'), defensor.id);


    if (chequearTurnoDefensor === defensor.id) {
      console.log(this.translate.instant('batalla.status.defenderStanding'));

      await this.delay(1000);
      if (defensor === this.pokemonJugador) {
        movimientoAtacante = movimientoSeleccionado;
      } else {
        movimientoAtacante = this.generarMovimientoRival();
      }

      await this.calcularAtaque(movimientoAtacante, defensor, atacante);
      await this.delay(100);

      await this.verificarCambio(atacante);
    }
  }
  //esta funcion hace que el rival utilize un movimiento de los 4 que tiene
  generarMovimientoRival(): Move {
    const movimientosPosibles = this.pokemonRival?.movimientos || [];
    //aca se utiliza la funcion math.random para utilizar uno de los 4 movimientos posibles
    const indiceAleatorio = Math.floor(Math.random() * movimientosPosibles.length);
    return movimientosPosibles[indiceAleatorio];
  }

  async verificarCambio(defensor: Pokemon): Promise<Pokemon> {
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
          await this.localizePokemon(defensor);

          const cryUrl = this.pokemonJugador.cryUrl;
          if (cryUrl) {
            await this.audio_service.playDynamicSound(cryUrl);
          }
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
          await this.localizePokemon(defensor);

          const cryUrl = this.pokemonRival.cryUrl;
          if (cryUrl) {
            await this.audio_service.playDynamicSound(cryUrl);
          }
        }
      }
    }
    return defensor;
  }

  async calcularAtaque(movimiento: Move, atacante: Pokemon, defensor: Pokemon) {
    console.log(`${this.transformarPrimeraLetra(atacante.especie)} ${this.translate.instant('batalla.status.performingMove')} ${this.transformarPrimeraLetra(movimiento.nombre)}`);
    const factor = this.calcularEfectividad(movimiento.tipo, defensor.tipos);
    
    this.audio_service.resumeContext();

    // SI ES JEFE, MANTENEMOS MÚSICA DE JEFE. SI NO, MÚSICA NORMAL.
    const musicaActual = this.isBossBattle ? 'bossBattle' : 'battleBGM';
    this.audio_service.playBGM(musicaActual);
    
    this.pokemonAtacanteId = atacante.id;
    await this.delay(600);
    if (movimiento.originalName) {
      await this.audio_service.playMoveSound(movimiento.originalName);
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

    await this.delay(700);
    this.pokemonAtacanteId = null;
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
      if(this.isBossBattle == true)
      {
        //es la sacred ash, mejor item curativo del juego
        id = 44;
      }
      this.pokeapi.getItemsById(id).subscribe({
        next: async (value: Items) => {
          await this.localizeItem(value, id);
          this.jugador?.items?.push(value);
          for (let i = 0; i < this.pokemonDebilitados.length; i++) {
            this.jugador?.equipo.push(this.pokemonDebilitados[i]);

          }
          this.jugador!.equipo.forEach(p => {
            p.vidaActual = p.estadisticas.hp;
            this.partida!.puntuacion = puntajeNuevo;
            this.partida!.duelosGanados = this.duelosGanados;
            this.partida!.personaje = this.jugador!;
          })
          this.ps.actualizarPuntaje(partidaId, this.partida as any).subscribe({
            next: (response) => {
              console.log(this.translate.instant('log.scoreUpdated'), response);
              this.partida!.puntuacion = puntajeNuevo;
              this.partida!.duelosGanados = this.duelosGanados;
              this.continuarBatalla();
            },
            error: (error: Error) => {
              console.error(this.translate.instant('log.scoreUpdateError'), error);
            }
          });

          this.isBossBattle = false;
        },
        error: (err: Error) => {
          console.log(err)
        },
      })

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
    this.pokemonDebilitados = []
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
    this.audio_service.playBGM("win");
    this.mensajeBatalla = this.translate.instant('batalla.status.preparingNextBattle');
  }


  cerrarModal() {
    const isWin = this.resultado;
    this.mostrarModal = false;
    this.resultado = '';
    this.mensajeModal = '';
    if (isWin) {
      this.audio_service.playBGM('battleBGM');
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


  async ejecutarCuracionHP(itemUsado: Items, itemIndex: number): Promise<void> {
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
    await this.delay(2000);

    const movimientoRival = this.generarMovimientoRival();
    await this.calcularAtaque(movimientoRival, this.pokemonRival!, this.pokemonJugador!);
    await this.verificarCambio(this.pokemonJugador!);
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

  async ejecutarRevivir(pokemonIndex: number): Promise<void> {
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
    await this.delay(2000);
    const movimientoRival = this.generarMovimientoRival();
    await this.calcularAtaque(movimientoRival, this.pokemonRival!, this.pokemonJugador!);
    await this.verificarCambio(this.pokemonJugador!);
  }





  async ejecutarSacredAsh(itemUsado: Items, itemIndex: number): Promise<void> {
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
      `${this.translate.instant('batalla.allFaintedRevived')} ${this.transformarPrimeraLetra(itemUsado.name)}.`);
    this.jugador!.items!.splice(itemIndex, 1);
    await this.delay(2000);
    const movimientoRival = this.generarMovimientoRival();
    await this.calcularAtaque(movimientoRival, this.pokemonRival!, this.pokemonJugador!);
    await this.verificarCambio(this.pokemonJugador!);
  }





  //sirve para poder elegir el volumen de los efectos de sonido
  public setBGMVolume(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newVolume = parseFloat(target.value);
    this.bgmVolume = newVolume;
    this.audio_service.setBGMVolume(newVolume);
  }
  //sirve para poder elegir el volumen de los efectos de sonido
  public setSFXVolume(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newVolume = parseFloat(target.value);
    this.sfxVolume = newVolume;
    this.audio_service.setSFXVolume(newVolume);
  }

  //Se utiza para limpiar la descripcion de los items
  limpiarDescripcion(texto: string): string {
    if (!texto) return '';
    // Reemplaza saltos de página (\f) y saltos de línea (\n) por espacios
    // y elimina espacios dobles resultantes.
    return texto.replace(/[\f\n\r]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  abrirMenuCambio(): void {
    if (this.jugador?.equipo.length === 1) {
      this.mostrarMensajeBatalla(this.translate.instant('batalla.status.onlyOnePokemon'));
      return;
    }
    this.modoSeleccion = 'cambio';
    this.mostrarSeleccionEquipo = true;
    this.mensajeBatalla = this.translate.instant('batalla.choosePokemonSwitch');
  }

  async ejecutarCambioPokemon(index: number): Promise<void> {
    const pokemonEntrante = this.jugador!.equipo[index];

    if (pokemonEntrante.id === this.pokemonJugador?.id) {
      this.mostrarMensajeBatalla(this.translate.instant('batalla.status.alreadyInBattle'));
      return;
    }

    this.mostrarSeleccionEquipo = false;
    this.modoSeleccion = null;
    this.audio_service.playSound('return');
    await this.delay(800);
    this.mostrarMensajeBatalla(`${this.transformarPrimeraLetra(this.pokemonJugador!.especie)} ${this.translate.instant('batalla.return')}!`);
    await this.delay(1000);


    const indexActual = 0;

    const temp = this.jugador!.equipo[indexActual];
    this.jugador!.equipo[indexActual] = this.jugador!.equipo[index];
    this.jugador!.equipo[index] = temp;

    this.pokemonJugador = this.jugador!.equipo[0];

    await this.localizePokemon(this.pokemonJugador);
    this.movimientosJugador = this.pokemonJugador.movimientos!;
    this.audio_service.playSound('out');
    await this.delay(700);

    this.mostrarMensajeBatalla(` ${this.transformarPrimeraLetra(this.pokemonJugador.especie)} ${this.translate.instant('batalla.go')}!`);


    const cryUrl = this.pokemonJugador.cryUrl;
    if (cryUrl) {
      await this.audio_service.playDynamicSound(cryUrl);
    }

    await this.delay(1500);

    const movimientoRival = this.generarMovimientoRival();
    await this.calcularAtaque(movimientoRival, this.pokemonRival!, this.pokemonJugador!);
    await this.verificarCambio(this.pokemonJugador!);
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

    this.itemCuracionSeleccionado = itemUsado;
    this.indiceItemCuracion = index;
    this.modoSeleccion = 'curacion';
    this.mostrarSeleccionEquipo = true;
    this.mostrarMensajeBatalla(`${this.translate.instant('batalla.selectTargetFor')} ${this.transformarPrimeraLetra(itemUsado.name)}.`);
  }

  async ejecutarCuracionSobreObjetivo(index: number): Promise<void> {
    const objetivo = this.jugador!.equipo[index];
    const itemUsado = this.itemCuracionSeleccionado;
    const itemIndex = this.indiceItemCuracion;

    if (objetivo.vidaActual === objetivo.estadisticas.hp) {
      this.mostrarMensajeBatalla(this.translate.instant('batalla.status.alreadyFullHP'));
      return;
    }

    this.mostrarSeleccionEquipo = false;
    this.modoSeleccion = null;

    const itemName = itemUsado!.name.toLowerCase();
    let curacionValor: number = this.healingValues[itemName] || 0;
    let curacionAplicada: number;

    if (curacionValor === 9999) {
      curacionAplicada = objetivo.estadisticas.hp - objetivo.vidaActual;
    } else {
      curacionAplicada = curacionValor;
    }

    const vidaAntes = objetivo.vidaActual;
    const vidaDeseada = vidaAntes + curacionAplicada;
    objetivo.vidaActual = Math.min(vidaDeseada, objetivo.estadisticas.hp);
    const vidaRestaurada = objetivo.vidaActual - vidaAntes;

    this.mostrarMensajeBatalla(
      `${this.transformarPrimeraLetra(objetivo.especie)} ${this.translate.instant('batalla.healed')} ${vidaRestaurada} ${this.translate.instant('batalla.hp')}`
    );

    this.jugador!.items!.splice(itemIndex, 1);
    this.itemCuracionSeleccionado = null;
    this.indiceItemCuracion = -1;

    await this.delay(2000);

    const movimientoRival = this.generarMovimientoRival();
    await this.calcularAtaque(movimientoRival, this.pokemonRival!, this.pokemonJugador!);
    await this.verificarCambio(this.pokemonJugador!);
  }

  onPokemonSeleccionado(index: number) {
    if (this.modoSeleccion === 'cambio') {
      this.ejecutarCambioPokemon(index);
    } else if (this.modoSeleccion === 'curacion') {
      this.ejecutarCuracionSobreObjetivo(index);
    }
  }

  cancelarSeleccionEquipo() {
    this.mostrarSeleccionEquipo = false;
    this.modoSeleccion = null;
    this.itemCuracionSeleccionado = null;
    this.indiceItemCuracion = -1;
  }

  // Actualiza un item existente usando su nombre para buscar la traducción
async actualizarIdiomaItemExistente(item: Items): Promise<void> {
  try {
    const idiomaActual = this.translate.currentLang || 'es';
    
    // Usamos el nombre (ej: 'potion') para buscar en la API
    const response = await fetch(`https://pokeapi.co/api/v2/item/${item.name}/`);
    const data = await response.json();

    // 1. Actualizar Nombre Localizado
    const nombreTraducido = data.names.find((n: any) => n.language.name === idiomaActual);
    if (nombreTraducido) {
      item.localizedName = nombreTraducido.name;
    }

    // 2. Actualizar Descripción
    const descripcionTraducida = data.flavor_text_entries.find((t: any) => t.language.name === idiomaActual);
    if (descripcionTraducida) {
      item.description = this.limpiarDescripcion(descripcionTraducida.text);
    } else {
      // Fallback a inglés si no hay español
      const descripcionEn = data.flavor_text_entries.find((t: any) => t.language.name === 'en');
      if (descripcionEn) {
        item.description = this.limpiarDescripcion(descripcionEn.text);
      }
    }
  } catch (error) {
    console.error(`Error actualizando idioma para ${item.name}:`, error);
  }
}

}