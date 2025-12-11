import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PokeAPIService } from '../../service/poke-api.service';
import { FormsModule } from '@angular/forms';
import { tipos } from '../../interface/tipos';
import { lastValueFrom, Observable } from 'rxjs';

type TypeFactor = { type: string; factor: number; displayType?: string };

@Component({
    selector: 'app-mini-pokedex',
    standalone:true,
    imports: [CommonModule, TranslateModule, FormsModule],
    templateUrl: './pokedex.html',
    styleUrls: ['./pokedex.css']
})
export class MiniPokedexComponent {
  //servicios
  pokeapi = inject(PokeAPIService);
  translate = inject(TranslateService);
  //errores
  searchTerm: string = '';
  errorMessage: string = '';
  //interfaces
  searchedPokemonData: {
    name: string;
    localizedName: string;
    types: string[];
    typesLocalized?: { type: string; displayType: string }[] | null;
    spriteUrl: string;
    effectiveness?: {
      immunities: TypeFactor[];
      superEffective: TypeFactor[];
      notEffective: TypeFactor[];
      neutral: TypeFactor[];
    };
  } | null = null;

  private typeNameCache = new Map<string, string>();

  //obtenemos las clases
  obtenerClaseTipoMovimiento(tipo: string): string {
    return tipo.toLocaleLowerCase();
  }

  //limpia el nombre
  transformarPrimeraLetra(nombre: string): string {
    if (!nombre) return nombre;
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }

  //obtenemos como el nombre del tipo para hacer un display
  private async getTypeDisplayName(typeName: string): Promise<string> {
    const key = typeName.toLowerCase();
    if (this.typeNameCache.has(key)) {
      return this.typeNameCache.get(key)!;
    }

    try {
      const localized = await lastValueFrom(this.pokeapi.getLocalizedTypeName(key));
      const finalLabel = localized || this.transformarPrimeraLetra(key);
      this.typeNameCache.set(key, finalLabel);
      return finalLabel;
    } catch (err) {
      const fallback = this.transformarPrimeraLetra(key);
      this.typeNameCache.set(key, fallback);
      return fallback;
    }
  }
  //buscamos el pokemon
  async searchPokemon(): Promise<void> {
    if (!this.searchTerm) { return }
    ;

    this.errorMessage = '';
    this.searchedPokemonData = null;
    //limpiamos el nombre para la busqueda, así de esta forma sigue el convenio de la pokeapi
    const searchKey = this.searchTerm
      .toLowerCase()
      .trim()
      .replace(/[\s\.:]+/g, '-');

      //conseguimos los detalles
    this.pokeapi.getPokemonDetails(searchKey).subscribe(async details => {
      if (!details) {
        this.errorMessage = this.translate.instant('batalla.pokedexNotFound');
        return;
      }

      //localizamos el nombre y conseguimos el sprite
      const localizedName = details.localizedName || details.name;
      const spriteData = await lastValueFrom(this.pokeapi.getSpriteByID(details.id));


      //se consiguen los tipos
      const types: string[] = details.types.map((t: { type: { name: string } }) => t.type.name.toLowerCase());

      //se consigue la data del pokemon
      this.searchedPokemonData = {
        name: details.name,
        localizedName,
        types,
        spriteUrl: spriteData?.front_default || ''
      };

      //conseguimos el display del tipo del pokemon
      const typesLocalized = await Promise.all(
        types.map(async t => {
          const displayType = await this.getTypeDisplayName(t);
          return { type: t, displayType };
        })
      );
      this.searchedPokemonData.typesLocalized = typesLocalized;

      //conseguimos la eficacio de los tipos hacia el pokemon
      const rawEffectiveness = this.computeStrengthsWeaknesses(types);
      await this.localizeEffectiveness(rawEffectiveness);

      this.searchedPokemonData.effectiveness = rawEffectiveness;
      this.searchTerm = '';
    }, err => {
      console.error(err);
      this.errorMessage = this.translate.instant('batalla.pokedexError');
    });
  }


  private computeStrengthsWeaknesses(pokemonTypes: string[]) {
    //inmunes *0 daño
    const immunities: TypeFactor[] = [];
    //super efectivos *2 daño o *4 daño dependiendo de los tipos
    const superEffective: TypeFactor[] = [];
    //no tan efectivos *.5 o *.25 dependiendo de los tipos
    const notEffective: TypeFactor[] = [];
    //neutral (estos no se muestran)
    const neutral: TypeFactor[] = [];
    //pone los tipos en minuscula
    const defenderTypesLower = pokemonTypes.map(t => t.toLowerCase());

    tipos.forEach(attackingType => {
      let factor = 1;
      for (const def of defenderTypesLower) {
        const efectEntry = attackingType.efectivity.find(([tipo, _]) => tipo === def);
        if (efectEntry) {
          factor *= efectEntry[1];
        } else {
          factor *= 1;
        }
      }

      const typeFactor: TypeFactor = { type: attackingType.name.toLowerCase(), factor };

      if (factor === 0) {
        immunities.push(typeFactor);
      } else if (factor > 1) {
        superEffective.push(typeFactor);
      } else if (factor < 1) {
        notEffective.push(typeFactor);
      } else {
        neutral.push(typeFactor);
      }
    });

    superEffective.sort((a, b) => b.factor - a.factor);
    notEffective.sort((a, b) => a.factor - b.factor);

    return { immunities, superEffective, notEffective, neutral };
  }

  private async localizeEffectiveness(effectiveness: {
    immunities: TypeFactor[];
    superEffective: TypeFactor[];
    notEffective: TypeFactor[];
    neutral: TypeFactor[];
  }) {
    const allLists = [
      effectiveness.immunities,
      effectiveness.superEffective,
      effectiveness.notEffective,
      effectiveness.neutral
    ];

    const promises: Promise<void>[] = [];

    allLists.forEach(list => {
      list.forEach(tf => {
        const p = this.getTypeDisplayName(tf.type).then(displayType => { tf.displayType = displayType; }).catch(() => { tf.displayType = this.transformarPrimeraLetra(tf.type); });
        promises.push(p);
      });
    });

    await Promise.all(promises);
  }

  formatoFactor(f: number): string {
    const short = Number.isInteger(f) ? f.toString() : f.toString().replace(/\.0+$/, '');
    return `x${short}`;
  }

  getTranslatedTypeName(typeName: string): Observable<string> {
    return this.pokeapi.getLocalizedTypeName(typeName);
  }
}