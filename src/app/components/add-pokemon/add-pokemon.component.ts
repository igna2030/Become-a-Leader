import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PokeAPIService } from '../../service/poke-api.service';
import { Pokemon } from '../../interface/pokemon';
import { Move } from '../../interface/move';
import { Stats } from '../../interface/stats';
import { TeamService } from '../../service/team.service';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../service/user.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppAudio } from '../app-audio/app-audio';

@Component({
    selector: 'app-add-pokemon',
    imports: [CommonModule, RouterModule, FormsModule, TranslateModule, AppAudio],
    templateUrl: './add-pokemon.component.html',
    styleUrl: './add-pokemon.component.css'
})
export class AddPokemonComponent {
  //id del pokemon
  pokeID: string = "";
  //servicios
  ps = inject(PokeAPIService);
  ts = inject(TeamService);
  us = inject(UserService);
  translate = inject(TranslateService);
  routes = inject(Router);
  //alertas tanto en ingles como español
  searchError: string | null = null;
  moveError: string | null = null;
  saveError: string | null = null;
  //interfaces
  pokeAPI: any;
  pokemon: Pokemon = {
    id: '',
    especie: '',
    tipos: [],
    nivel: 0,
    vidaActual: 0,
    estadisticas: { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 },
    movimientos: [],
    idEntrenador: '',
    cryUrl:''
  };

  statsBase: Stats = {
    hp: 0,
    atk: 0,
    def: 0,
    satk: 0,
    sdef: 0,
    spd: 0
  };

  iv: any;
  moves: Move[] = [];

  //Limpia los valores de la variable
  cleanBuffer() {
    this.pokeID = "";
    this.pokeAPI = null; 
    this.pokemon = {
      id: '',
      especie: '',
      tipos: [],
      nivel: 0,
      vidaActual: 0,
      estadisticas: { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 },
      movimientos: [],
      idEntrenador: '',
      cryUrl:''
    }
    this.statsBase = {
      hp: 0,
      atk: 0,
      def: 0,
      satk: 0,
      sdef: 0,
      spd: 0
    };
    this.iv = [];
    this.moves = [];
    this.searchError = null;
    this.moveError = null;
    this.saveError = null;
  }

  //Busca los datos de un pokemon en la pokeAPI a travez del servicio
  generarPokemon(id: string) {
    this.searchError = null;
    this.moveError = null;
    this.saveError = null;
    this.pokeAPI = null; // Ocultar resultados anteriores
    this.moves = []; // Limpiar movimientos

    this.ps.getPokemonByID(id).subscribe({
      next: (data) => {
        this.pokeAPI = data;
        this.statsBase = {
          hp: this.pokeAPI.stats[0].base_stat,
          atk: this.pokeAPI.stats[1].base_stat,
          def: this.pokeAPI.stats[2].base_stat,
          satk: this.pokeAPI.stats[3].base_stat,
          sdef: this.pokeAPI.stats[4].base_stat,
          spd: this.pokeAPI.stats[5].base_stat
        }
      },
      error: (err: Error) => {
        console.log("ERROR: " + err.message);
        this.translate.get('alerts.pokemonNotFound', { id: id }).subscribe((res: string) => {
          this.searchError = res;
        });
      }
    });
  }

  //Agrega los movimientos a un arreglo de movimientos
  agregarAtaque(moveName: string) {
    this.moveError = null;

    this.ps.getMoveByName(moveName).subscribe({
      next: (data) => {
        if (data.damage_class.name !== 'status') {
          if (this.moves.length < 4) {
            const move: Move = {
              nombre: moveName,
              tipo: data.type.name,
              clase: data.damage_class.name,
              potencia: data.power,
              precision: data.accuracy,
              usos: data.pp,
              pp: data.pp,
              originalName: moveName,
              originalType: data.type.name
            }
            console.log(move);
            this.moves.push(move);
          } else {

            this.translate.get('alerts.tooManyMoves').subscribe((res: string) => {
              this.moveError = res;
            });
          }
        }
      },
      error: (err: Error) => {
        console.log('ERROR: ' + err.message);
      }
    });
  }

  //Genera estadisticas IV random entre 0 31
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

  //Calcula las estadisticas maximas del pokemon a travez del nivel
  private calculateStats(base: number, iv: number, ev: number, level: number, isHP = false) {
    if (isHP) {
      return Math.floor((((2 * base + iv + (ev / 4)) * level) / 100) + level + 10);
    } else {
      return Math.floor((((2 * base + iv + (ev / 4)) * level) / 100) + 5);
    }
  }

  //Genera un numero random entre 0 y 84
  private generateEV(min: number, max: number) {
    return Math.round(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  //Agrega el pokemon a la db.json en el apartado pokemons
  addPokemonBD() {
    this.saveError = null;

    // Validar que el Pokémon tenga exactamente 4 movimientos
    if (this.moves.length !== 4) {
      this.translate.get('alerts.mustHaveFourMoves').subscribe((res: string) => {
        this.saveError = res;
      });
      return;
    }

    // Verificar si el Pokémon ya existe en la base de datos
    this.ts.getPokemons().subscribe({
      next: (pokemons) => {
        const existe = pokemons.some((poke) => poke.id === this.pokeAPI.id.toString());
        if (existe) {
          this.translate.get('alerts.pokemonExists', { id: this.pokeAPI.id }).subscribe((res: string) => {
            this.saveError = res;
          });
          this.moves = []; // Limpiar movimientos para evitar spam
          return;
        }

        // Proceder con la creación del Pokémon
        this.pokemon.id = this.pokeAPI.id.toString();
        this.pokemon.especie = this.pokeAPI.name;

        if (this.pokeAPI.cries) {
          this.pokemon.cryUrl = this.pokeAPI.cries.latest || this.pokeAPI.cries.legacy || '';
        }

        for (let i = 0; i < this.pokeAPI.types.length; i++) {
          this.pokemon.tipos.push(this.pokeAPI.types[i].type.name);
        }
        this.pokemon.nivel = 100;
        this.iv = this.generateIVs();
        this.pokemon.estadisticas = {
          hp: this.calculateStats(this.statsBase.hp, this.iv.hp, this.generateEV(1, 84), this.pokemon.nivel, true),
          atk: this.calculateStats(this.statsBase.atk, this.iv.atk, this.generateEV(1, 84), this.pokemon.nivel, false),
          def: this.calculateStats(this.statsBase.def, this.iv.def, this.generateEV(1, 84), this.pokemon.nivel, false),
          satk: this.calculateStats(this.statsBase.satk, this.iv.satk, this.generateEV(1, 84), this.pokemon.nivel, false),
          sdef: this.calculateStats(this.statsBase.sdef, this.iv.sdef, this.generateEV(1, 84), this.pokemon.nivel, false),
          spd: this.calculateStats(this.statsBase.spd, this.iv.spd, this.generateEV(1, 84), this.pokemon.nivel, false),
        };
        this.pokemon.vidaActual = this.pokemon.estadisticas.hp;
        this.pokemon.movimientos = this.moves;
        this.pokemon.idEntrenador = '';

        console.log('Pokemon a guardar:', this.pokemon);

        this.ts.addPokemon(this.pokemon).subscribe({
          next: () => {
            console.log("Pokémon Agregado");
            this.cleanBuffer();
            this.routes.navigate(['pokemon-list']);
          },
          error: (err: Error) => {
            console.log('ERROR: ' + err.message);
            this.translate.get('alerts.genericSaveError').subscribe((res: string) => {
              this.saveError = res;
            });
          }
        });
      },
      error: (err) => {
        console.log('ERROR: ' + err.message);
        this.translate.get('alerts.genericSaveError').subscribe((res: string) => {
          this.saveError = res;
        });
      }
    });
  }

  logout() {
    this.us.logoutAdmin();
    this.routes.navigate(['']);
  }
}