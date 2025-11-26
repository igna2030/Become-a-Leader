import { Injectable } from '@angular/core';
import { SoundBuffer } from '../interface/sound-buffer';
import { Observable, forkJoin } from 'rxjs';
//Se utiliza la Web Audio API
// Definición de tipos para las claves de música y SFX
type BGMKey = 'battleBGM' | 'intro' | 'win' | 'lose' | 'finalBattle' | 'bossBattle';
type SFXKey = 'hit' | 'out' | 'return';
type SoundFileMap = Record<SFXKey, string> & Record<BGMKey, string | string[]>;

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private audioContext: AudioContext;

  // Buffers para sonidos estáticos (cargados al inicio)
  private soundBuffers: SoundBuffer = {};

  // CACHE DINÁMICA: Aquí guardamos los gritos descargados para no pedirlos 2 veces
  private dynamicSoundCache = new Map<string, AudioBuffer>();

  private isLoaded = false;

  // Propiedades para el control de la lista de reproducción 
  private currentSource: AudioBufferSourceNode | null = null;
  private currentPlaylistKey: BGMKey | null = null;
  private sfxGainNode: GainNode;
  private bgmGainNode: GainNode;
  private currentTrackIndex: number = -1;
  private currentBGMVolume: number = this.loadBGMVolume();
  private currentsfxVolume: number = this.loadSFXVolume();
  private bgmVolume: number = this.loadVolume('bgmVolume', 0.5);
  private sfxVolume: number = this.loadVolume('sfxVolume', 0.8);
  private readonly CACHE_NAME = 'pokemon-audio-cache-v1';

  // Música para todo el programa 
  private soundFiles: SoundFileMap = {
    hit: 'assets/audio/hit.mp3',
    out: 'assets/audio/pokemon_out.mp3',
    return: 'assets/audio/pokemon_return.mp3',
    win: [
      'assets/audio/victory_gen_1.mp3',
      'assets/audio/victory_gen3_red.mp3',
      'assets/audio/win.mp3',
      'assets/audio/win_2.mp3'
    ],
    intro: [
      'assets/audio/pokemon_fire_and_red_intro.mp3',
      'assets/audio/pokemon_gen_1_intro.mp3',
      'assets/audio/intro3.mp3'
    ],
    battleBGM: [
      'assets/audio/battle_red_fire.mp3',
      'assets/audio/battle_green_blue_gen1.mp3',
      'assets/audio/combat.mp3',
      'assets/audio/no_victory_without_toll.mp3'
    ],
    lose: [
      'assets/audio/lose.mp3'
    ],
    finalBattle: [
      'assets/audio/arceus-theme.mp3'
    ],
    bossBattle: [
      'assets/audio/Chaos.mp3',
      'assets/audio/boss_battle_song.mp3',
      'assets/audio/boss_battle_song2.mp3'
    ],
  };

  constructor() {
    const AudioContextClass =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.bgmGainNode = this.audioContext.createGain();
    this.sfxGainNode = this.audioContext.createGain();

    this.bgmGainNode.connect(this.audioContext.destination);
    this.sfxGainNode.connect(this.audioContext.destination);

    this.bgmGainNode.gain.setValueAtTime(this.bgmVolume, this.audioContext.currentTime);
    this.sfxGainNode.gain.setValueAtTime(this.sfxVolume, this.audioContext.currentTime);
    this.sfxVolume = this.currentsfxVolume;

    this.loadSounds();
  }


  private loadVolume(key: string, defaultValue: number): number {
    const savedVolume = localStorage.getItem(key);
    return savedVolume ? parseFloat(savedVolume) : defaultValue;
  }

  private loadBGMVolume(): number {
    const savedVolume = localStorage.getItem('bgmVolume');
    return savedVolume ? parseFloat(savedVolume) : 0.5;
  }
  public getBGMVolume(): number {
    return this.currentBGMVolume;
  }

  public setBGMVolume(volume: number): void {
    volume = Math.max(0, Math.min(1, volume));
    this.bgmVolume = volume;
    this.currentBGMVolume = volume;
    this.bgmGainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    localStorage.setItem('bgmVolume', volume.toString());
  }

  public setSFXVolume(volume: number): void {
    volume = Math.max(0, Math.min(1, volume));
    this.currentsfxVolume = volume;
    this.sfxGainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    localStorage.setItem('sfxVolume', volume.toString());
  }
  private loadSFXVolume(): number {
    const savedVolume = localStorage.getItem('sfxVolume');
    return savedVolume ? parseFloat(savedVolume) : 0.8;
  }
  public getsfxVolume() {
    return this.currentsfxVolume;
  }

  private async loadSounds(): Promise<void> {
    const fileKeys = (
      Object.keys(this.soundFiles) as (keyof typeof this.soundFiles)[]
    ).filter((key) => typeof this.soundFiles[key] === 'string');

    const promises = fileKeys.map((key) =>
      this.fetchAndDecodeAudio(key as string, this.soundFiles[key] as string)
    );

    try {
      await Promise.all(promises);
      this.isLoaded = true;
      console.log('Audio buffers loaded successfully.');
    } catch (error) {
      console.error('Error loading audio buffers:', error);
    }
  }

  private async fetchAndDecodeAudio(key: string, url: string): Promise<void> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    return new Promise((resolve, reject) => {
      this.audioContext.decodeAudioData(
        arrayBuffer,
        (buffer) => {
          this.soundBuffers[key] = buffer;
          resolve();
        },
        (error) => {
          console.error(`Error decoding audio file ${url}:`, error);
          reject(error);
        }
      );
    });
  }


  // Método auxiliar para no repetir código al crear la fuente de audio
  private playBuffer(buffer: AudioBuffer, destination: GainNode): void {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(e => console.error(e));
    }

    source.connect(destination);
    source.start(0);
  }

  public playSound(key: keyof typeof this.soundFiles): void {
    if (!this.isLoaded) return;
    const buffer = this.soundBuffers[key];
    if (!buffer) return;
    this.playBuffer(buffer, this.sfxGainNode);
  }

  // Utilizo un sonido dinamico como el grito de los pokemon CON CACHE
  // Modifica el método para que acepte ID o URL, pero usaremos jsDelivr
  public async playDynamicSound(input: string): Promise<void> {
    if (!input) return;

    let url = input;

    // Si recibimos una URL vieja de GitHub Raw, la transformamos a jsDelivr
    if (input.includes('raw.githubusercontent.com')) {
      url = input.replace(
        'https://raw.githubusercontent.com/PokeAPI/cries/main',
        'https://cdn.jsdelivr.net/gh/PokeAPI/cries@main'
      );
    }
    // Si recibimos solo el ID (ej: "384"), construimos la URL buena directamente
    else if (!input.includes('http')) {
      url = `https://cdn.jsdelivr.net/gh/PokeAPI/cries@main/cries/pokemon/latest/${input}.ogg`;
    }


    if (this.dynamicSoundCache.has(url)) {
      const cachedBuffer = this.dynamicSoundCache.get(url)!;
      this.playBuffer(cachedBuffer, this.sfxGainNode);
      return;
    }

    try {
      const cache = await caches.open(this.CACHE_NAME); // Asegúrate de tener definido CACHE_NAME
      let response = await cache.match(url);

      if (!response) {
        response = await fetch(url);

        if (!response.ok) throw new Error(`Status: ${response.status}`);

        // Guardar en caché del navegador
        cache.put(url, response.clone());
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Guardar en caché de memoria
      this.dynamicSoundCache.set(url, audioBuffer);

      this.playBuffer(audioBuffer, this.sfxGainNode);

    } catch (error) {
      console.warn('Error reproduciendo sonido:', error);
    }
  }


  public stopBGM(): void {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
      this.currentPlaylistKey = null;
      this.currentTrackIndex = -1;
    }
  }

  public playBGM(key: BGMKey): void {
    if (this.currentPlaylistKey === key) {
      return
    };
    this.stopBGM();
    const musicEntry = this.soundFiles[key];
    let playlist: string[];
    if (Array.isArray(musicEntry)) {
      playlist = musicEntry;
    } else {
      playlist = [musicEntry];
    }
    if (!playlist || playlist.length === 0) {
      return
    };
    const initialIndex = Math.floor(Math.random() * playlist.length);
    this.playSequentialTrack(key, initialIndex);
  }

  public resumeContext(): void {
    if (this.audioContext.state === 'suspended') {
      this.audioContext
        .resume()
        .then(() => {
          console.log('AudioContext reanudado exitosamente.');
        })
        .catch((e) => console.error('Error al reanudar AudioContext:', e));
    }
  }

  private playSequentialTrack(key: BGMKey, index: number): void {
    const musicEntry = this.soundFiles[key] as string[];
    if (index < 0 || index >= musicEntry.length) return;

    const selectedUrl = musicEntry[index];
    const bufferKey = selectedUrl;

    if (this.soundBuffers[bufferKey]) {
      this.startTrackWithOnEnded(key, index, bufferKey);
    } else {
      this.fetchAndDecodeAudio(bufferKey, selectedUrl)
        .then(() => {
          if (
            this.currentPlaylistKey === key ||
            this.currentPlaylistKey === null
          ) {
            this.startTrackWithOnEnded(key, index, bufferKey);
          }
        })
        .catch((e) =>
          console.error(`Error loading BGM track ${index} for ${key}:`, e)
        );
    }
  }

  private startTrackWithOnEnded(
    key: BGMKey,
    index: number,
    bufferKey: string
  ): void {
    this.stopBGM();

    const buffer = this.soundBuffers[bufferKey];
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    source.connect(this.bgmGainNode);

    source.onended = () => {
      this.playNextTrackInSequence(key);
    };
    source.start(0);
    this.currentSource = source;
    this.currentPlaylistKey = key;
    this.currentTrackIndex = index;
  }




  private normalizeMoveNameForFile(apiName: string): string {
    let formattedName = apiName.replace(/_/g, '-');
    formattedName = formattedName.toLowerCase();
    formattedName = formattedName.replace(/\s/g, '-');
    return formattedName;
  }

  private playNextTrackInSequence(key: BGMKey): void {
    if (this.currentPlaylistKey !== key) {
      return
    };
    const musicEntry = this.soundFiles[key] as string[];
    if (!musicEntry || musicEntry.length === 0) {
      return
    };
    const currentTrack = this.currentTrackIndex;
    let nextIndex: number;
    // Evita repetir la misma canción si hay más de una opción
    if (musicEntry.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * musicEntry.length);
      } while (nextIndex === currentTrack);
    } else {
      nextIndex = 0;
    }

    this.playSequentialTrack(key, nextIndex);
  }


  private playBufferAndWait(buffer: AudioBuffer, destination: GainNode): Promise<void> {
    return new Promise((resolve) => {
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(destination);
      source.onended = () => {
        resolve();
      };
      source.start(0);
    });
  }

  public async playMoveSound(moveName: string): Promise<void> {
    if (!moveName) return Promise.resolve();
    const apiName = moveName.toLowerCase();
    const fileName = this.normalizeMoveNameForFile(apiName);
    const soundUrl = `assets/audio/moves/${fileName}.mp3`;

    try {
      const response = await fetch(soundUrl);

      if (!response.ok) {
        // Si no existe el sonido, resolvemos inmediatamente para no trabar el juego
        return Promise.resolve();
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Decodificamos el audio
      const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
        this.audioContext.decodeAudioData(arrayBuffer, resolve, reject);
      });

      // Llamamos al método que ESPERA a que termine el sonido
      return this.playBufferAndWait(audioBuffer, this.sfxGainNode);

    } catch (error) {
       // Si hay error, resolvemos la promesa para que el juego continúe
       return Promise.resolve();
    }
  }
}