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
  private bgmVolume: number = 0.5;
  private sfxVolume: number = 0.5;
  private currentBGMVolume: number = this.loadBGMVolume();
  private currentsfxVolume: number = this.loadSFXVolume();

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
    this.sfxGainNode.gain.setValueAtTime(this.currentsfxVolume, this.audioContext.currentTime);
    this.sfxVolume = this.currentsfxVolume;

    this.loadSounds();
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
  public async playDynamicSound(url: string): Promise<void> {
    if (!url) return;

    // 1 Verificar CACHÉ: Si ya lo tenemos, lo usamos y NO hacemos fetch a GitHub
    if (this.dynamicSoundCache.has(url)) {
      const cachedBuffer = this.dynamicSoundCache.get(url)!;
      this.playBuffer(cachedBuffer, this.sfxGainNode);
      return;
    }

    try {
      //  Si no está en caché, lo descargamos
      const response = await fetch(url);

      // Si GitHub nos da 429 (Too Many Requests), salimos silenciosamente
      if (response.status === 429) {
        console.warn(`[Audio] Rate Limit 429 en: ${url}. Saltando sonido.`);
        return; 
      }

      if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      //  Decodificamos
      const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
        this.audioContext.decodeAudioData(arrayBuffer, resolve, reject);
      });

      //  GUARDAMOS EN CACHÉ para la próxima vez
      this.dynamicSoundCache.set(url, audioBuffer);

      //  Reproducimos
      this.playBuffer(audioBuffer, this.sfxGainNode);

    } catch (error) {
      // Capturamos EncodingError para que el juego NO se congele
      console.warn('Error playing dynamic sound (puede ser formato corrupto o error de red):', error);
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


  public async playMoveSound(moveName: string): Promise<void> {
    if (!moveName) return;

    const apiName = moveName.toLowerCase();
    const fileName = this.normalizeMoveNameForFile(apiName);
    const soundUrl = `assets/audio/moves/${fileName}.mp3`;

    try {
      const response = await fetch(soundUrl);

      if (!response.ok) {
        // Ignoramos silenciosamente si no existe el sonido del movimiento
        return;
      }

      const arrayBuffer = await response.arrayBuffer();

      const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
        this.audioContext.decodeAudioData(arrayBuffer, resolve, reject);
      });

      this.playBuffer(audioBuffer, this.sfxGainNode);

    } catch (error) {
       // Catch error para que no moleste en consola si falta un archivo local
    }
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
}