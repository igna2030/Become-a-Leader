import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap, shareReplay, of, tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { Items } from '../interface/items';

@Injectable({
  providedIn: 'root',
})
export class PokeAPIService {
  http = inject(HttpClient);
  url = 'https://pokeapi.co/api/v2/';
  private translate_service = inject(TranslateService);

  // CACHE: Guarda las respuestas API para evitar la reiteracion de llamadas
  private cache = new Map<string, Observable<any>>();

  private getCurrentLang(): string {
    return this.translate_service.currentLang || 'en';
  }

  // Se fija si se tiene la data en chache, en caso contrario se la pide a la API
  private fetchWithCache(url: string): Observable<any> {
    if (!this.cache.has(url)) {
      const request$ = this.http.get<any>(url).pipe(
        shareReplay(1) // Este operador asegura que la solicitud se comparta y se almacene en el cache
      );
      this.cache.set(url, request$);
    }
    return this.cache.get(url)!;
  }

  //POKEMON
  getPokemonByID(id: string): Observable<any> {
    return this.fetchWithCache(this.url + 'pokemon/' + id);
  }

  //STATS
  getStatsByID(id: string): Observable<any> {
    return this.fetchWithCache(this.url + 'stat/' + id);
  }

  //consigue los datos de los pokemon
  getPokemonDetails(idOrName: string | number): Observable<any> {
    //se utiliza fetchWithCache para optimizar las llamadas
    return this.fetchWithCache(`${this.url}pokemon/${idOrName}`).pipe(
      switchMap((pokemonData) => {
        const pokemonId = pokemonData.id;

        // consique datos localizados 
        return this.getLocalizedSpeciesData(pokemonId).pipe(
          map((localizedData) => {
            return {
              ...pokemonData,
              ...localizedData,
              name: localizedData.localizedName, 
              originalName: pokemonData.name,    
              especie: localizedData.localizedName,
              cryUrl: pokemonData.cries?.latest || pokemonData.cries?.legacy,
            };
          })
        );
      })
    );
  }

  //MOVES
  getMoveByName(name: string): Observable<any> {
    const currentLang = this.getCurrentLang();
    const cleanName = name.split(':')[0].toLowerCase().replace(/\s/g, '-');

    return this.fetchWithCache(this.url + 'move/' + cleanName).pipe(
      map((moveData) => {
        const localizedName = moveData.names.find(
          (n: any) => n.language.name === currentLang
        );
        const localizedEffect = moveData.effect_entries.find(
          (e: any) => e.language.name === currentLang
        );

        return {
          ...moveData,
          name: localizedName ? localizedName.name : moveData.name,
          originalSlug: moveData.name,
          effect: localizedEffect
            ? localizedEffect.effect
            : 'No effect description found.',
        };
      })
    );
  }

  getMoveLocalizedName(name: string): Observable<string> {
    return this.getMoveByName(name).pipe(map((data) => data.name));
  }

  //consigue el pokemon localizado
  private getLocalizedSpeciesData(idOrName: string | number): Observable<{ localizedName: string; flavor_text: string }> {
    const currentLang = this.getCurrentLang();

    return this.fetchWithCache(`${this.url}pokemon-species/${idOrName}`).pipe(
      map((speciesData) => {
        const localizedNameEntry = speciesData.names.find(
          (name: any) => name.language.name === currentLang
        );
        const flavorEntry = speciesData.flavor_text_entries.find(
          (entry: any) => entry.language.name === currentLang
        );
        return {
          localizedName: localizedNameEntry
            ? localizedNameEntry.name
            : speciesData.name,
          flavor_text: flavorEntry
            ? flavorEntry.flavor_text.replace(/[\n\r\f]/g, ' ')
            : 'No description found.',
        };
      })
    );
  }

  //consigue el tipo del pokemon localizado
  getLocalizedTypeName(typeName: string): Observable<string> {
    const currentLang = this.getCurrentLang();
    return this.fetchWithCache(`${this.url}type/${typeName}`).pipe(
      map((typeData) => {
        const localizedNameEntry = typeData.names.find(
          (name: any) => name.language.name === currentLang
        );
        return localizedNameEntry ? localizedNameEntry.name : this.transformarPrimeraLetra(typeName);
      })
    );
  }

  getPokemonLocalizedName(name: string): Observable<string> {
    return this.getLocalizedSpeciesData(name).pipe(map((data) => data.localizedName));
  }

  private transformarPrimeraLetra(nombre: string): string {
    if (!nombre) return nombre;
    return nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
  }

  //SPRITES
  getSpriteByID(id: string): Observable<any> {
    return this.fetchWithCache(this.url + 'pokemon/' + id).pipe(
      map((data: any) => data?.sprites)
    );
  }

  //Lista de pokemon 
  getPokemonList(limit: number = 20, offset: number = 0): Observable<any> {
    return this.http.get<any>(`${this.url}pokemon?limit=${limit}&offset=${offset}`);
  }


  getItemsById(id: number): Observable<Items> {
    return this.fetchWithCache(this.url + 'item/' + id).pipe(
      map((itemData: any) => {
        const currentLang = this.getCurrentLang();
        
        const localizedName = itemData.names.find(
          (n: any) => n.language.name === currentLang
        );
        
        const descriptionEntry = itemData.flavor_text_entries.find(
          (entry: any) => entry.language.name === currentLang
        );


        const sprite = itemData.sprites ? itemData.sprites.default : null;

        const item: Items = {
          name: itemData.name,
          category: itemData.category,
          localizedName: localizedName ? localizedName.name : itemData.name,
          description: descriptionEntry
            ? descriptionEntry.text.replace(/[\n\r\f]/g, ' ')
            : 'No description found.',
          sprite: sprite
        };
        return item;
      })
    );
  }

  getItemsSprites(id: number): Observable<any> {
    return this.fetchWithCache(this.url + 'item/' + id).pipe(
      map((data: any) => data?.sprites)
    );
  }

    //consigue el nombre original del pokemon
  getPokemonOriginalName(localizedName: string): Observable<string> {
    return this.http.get<any>(`${this.url}pokemon-species/${localizedName}`).pipe(
      map(speciesData => {
        const englishNameEntry = speciesData.names.find(
          (name: any) => name.language.name === 'en'
        );
        return englishNameEntry ? englishNameEntry.name : speciesData.name;
      })
    );
  }
    //consigue el tipo original
  getOriginalTypeName(localizedName: string): Observable<string> {
    return this.http.get<any>(`${this.url}type/${localizedName}`).pipe(
      map(typeData => {
        return typeData.name;
      })
    );
  }
}