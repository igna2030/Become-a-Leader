const fs = require('fs').promises;
const path = require('path');
const axios = require('axios'); 

const POKEAPI_URL = 'https://pokeapi.co/api/v2/pokemon/';
const DB_PATH = path.join(__dirname, 'db.json');


function generateIVs() {
  return {
    hp: Math.floor(Math.random() * 32),
    atk: Math.floor(Math.random() * 32),
    def: Math.floor(Math.random() * 32),
    satk: Math.floor(Math.random() * 32),
    sdef: Math.floor(Math.random() * 32),
    spd: Math.floor(Math.random() * 32),
  };
}

function generateEV(min, max) {
  return Math.round(Math.floor(Math.random() * (max - min + 1)) + min);
}

function calculateStats(base, iv, ev, level, isHP = false) {
  if (isHP) {
    return Math.floor((((2 * base + iv + (ev / 4)) * level) / 100) + level + 10);
  } else {
    return Math.floor((((2 * base + iv + (ev / 4)) * level) / 100) + 5);
  }
}

async function recalcularStatsPokemon(pokemon) {
  console.log(`Procesando: ${pokemon.especie} (ID: ${pokemon.id})...`);
  
  try {
    const response = await axios.get(`${POKEAPI_URL}${pokemon.id}`);
    const apiData = response.data; 

    const apiStats = apiData.stats;
    const baseStats = {};
    apiStats.forEach(s => {
      switch (s.stat.name) {
        case 'hp': baseStats.hp = s.base_stat; break;
        case 'attack': baseStats.atk = s.base_stat; break;
        case 'defense': baseStats.def = s.base_stat; break;
        case 'special-attack': baseStats.satk = s.base_stat; break;
        case 'special-defense': baseStats.sdef = s.base_stat; break;
        case 'speed': baseStats.spd = s.base_stat; break;
      }
    });

    const ivs = generateIVs();
    const nivel = 100; 

    const nuevasEstadisticas = {
      hp: calculateStats(baseStats.hp, ivs.hp, generateEV(1, 84), nivel, true),
      atk: calculateStats(baseStats.atk, ivs.atk, generateEV(1, 84), nivel, false),
      def: calculateStats(baseStats.def, ivs.def, generateEV(1, 84), nivel, false),
      satk: calculateStats(baseStats.satk, ivs.satk, generateEV(1, 84), nivel, false),
      sdef: calculateStats(baseStats.sdef, ivs.sdef, generateEV(1, 84), nivel, false),
      spd: calculateStats(baseStats.spd, ivs.spd, generateEV(1, 84), nivel, false),
    };

    pokemon.estadisticas = nuevasEstadisticas;
    pokemon.vidaActual = nuevasEstadisticas.hp; 


    if (apiData.cries) {
        pokemon.cryUrl = apiData.cries.latest || apiData.cries.legacy || null;
    } else {
        pokemon.cryUrl = null;
    }

    console.log(` -> ¡Actualizado! Stats corregidos y Cry añadido para ${pokemon.especie}`);
    return pokemon;

  } catch (error) {
    console.error(`Error procesando ${pokemon.especie} (ID: ${pokemon.id}): ${error.message}`);
    return pokemon;
  }
}

async function migrarBaseDeDatos() {
  console.log('Iniciando migración (Stats + Cries)...');
  
  let data;
  try {
    const rawData = await fs.readFile(DB_PATH, 'utf-8');
    data = JSON.parse(rawData);
  } catch (err) {
    console.error('Error: No se pudo leer el archivo db.json.', err);
    return;
  }

  const promesas = [];

  if (data.pokemons && data.pokemons.length > 0) {
    console.log(`\n--- Actualizando ${data.pokemons.length} Pokémon en la lista 'pokemons' ---`);
    data.pokemons.forEach((poke, index) => {
      promesas.push(
        recalcularStatsPokemon(poke).then(pokeActualizado => {
          data.pokemons[index] = pokeActualizado;
        })
      );
    });
  }

  if (data.partidas && data.partidas.length > 0) {
    console.log(`\n--- Actualizando Pokémon en ${data.partidas.length} partidas guardadas ---`);
    data.partidas.forEach((partida, pIndex) => {
      if (partida.personaje && partida.personaje.equipo) {
        partida.personaje.equipo.forEach((poke, eIndex) => {
          promesas.push(
            recalcularStatsPokemon(poke).then(pokeActualizado => {
              data.partidas[pIndex].personaje.equipo[eIndex] = pokeActualizado;
            })
          );
        });
      }
    });
  }

  await Promise.all(promesas);

  try {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log('\n¡Migración completada! Tu db.json ahora tiene stats recalculados y URLs de sonido.');
  } catch (err) {
    console.error('Error: No se pudo guardar el archivo db.json actualizado.', err);
  }
}

migrarBaseDeDatos();