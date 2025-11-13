import { Injectable } from '@angular/core';
import { SoundBuffer } from '../interface/sound-buffer'; // Asegúrate de tener esta interfaz
import { Observable, forkJoin } from 'rxjs';

// Definición de tipos para las claves de música y SFX
type BGMKey = 'battleBGM' | 'intro' | 'win' | 'lose' | 'finalBattle' | 'bossBattle';
type SFXKey = 'hit';
type SoundFileMap = Record<SFXKey, string> & Record<BGMKey, string | string[]>;

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  private audioContext: AudioContext;
  private soundBuffers: SoundBuffer = {};
  private isLoaded = false;

  // Propiedades para el control de la lista de reproducción (playlist)
  private currentSource: AudioBufferSourceNode | null = null;
  private currentPlaylistKey: BGMKey | null = null;
  private sfxGainNode: GainNode;
  private bgmGainNode: GainNode;
  private currentTrackIndex: number = -1;
  private bgmVolume: number = 0.5;
  private sfxVolume: number = 0.8;
  private currentBGMVolume: number = this.loadBGMVolume();

  private soundFiles: SoundFileMap = {
    hit: 'assets/audio/hit.mp3',
    win: [
      'assets/audio/victory_gen_1.mp3',
      'assets/audio/victory_gen3_red.mp3',
      'assets/audio/win.mp3'
    ],
    intro: [
      'assets/audio/pokemon_fire_and_red_intro.mp3',
      'assets/audio/pokemon_gen_1_intro.mp3',
      'assets/audio/intro3.mp3'],
    battleBGM: [
      'assets/audio/battle_red_fire.mp3',
      'assets/audio/battle_green_blue_gen1.mp3',
      'assets/audio/combat.mp3',
    ],
    lose: [
      'assets/audio/lose.mp3'
    ],
    finalBattle: [
      'assets/audio/arceus-theme.mp3'
    ],
    bossBattle: [
      'assets/audio/boss-theme-ftl.mp3'
    ]
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

    this.loadSounds();
  }

  private loadBGMVolume(): number {
    const savedVolume = localStorage.getItem('bgmVolume');
    return savedVolume ? parseFloat(savedVolume) : 0.5;
  }
  public getBGMVolume(): number {
    return this.currentBGMVolume;
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

  public playSound(key: keyof typeof this.soundFiles): void {
    if (!this.isLoaded) return;

    const buffer = this.soundBuffers[key];
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    source.connect(this.sfxGainNode);
    source.start(0);
  }

  public async playDynamicSound(url: string): Promise<void> {
    if (!url) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
        this.audioContext.decodeAudioData(arrayBuffer, resolve, reject);
      });

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      source.connect(this.sfxGainNode);
      source.start(0);
    } catch (error) {
      console.error('Error playing dynamic sound:', error);
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

  private startLoopingBGM(key: string): void {
    const buffer = this.soundBuffers[key];
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    source.connect(this.bgmGainNode);
    source.start(0);

    this.currentSource = source;
    this.currentPlaylistKey = key as BGMKey;
    this.currentTrackIndex = 0;
  }

  public async playMoveSound(moveName: string): Promise<void> {
    if (!moveName) return;

    const apiName = moveName.toLowerCase();

    const fileName = this.normalizeMoveNameForFile(apiName);

    const soundUrl = `assets/audio/moves/${fileName}.mp3`;

    try {
      const response = await fetch(soundUrl);

      if (!response.ok) {
        console.warn(
          `404 Not Found: Could not load sound from URL: ${soundUrl}`
        );
        return;
      }

      const arrayBuffer = await response.arrayBuffer();

      const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
        this.audioContext.decodeAudioData(arrayBuffer, resolve, reject);
      });

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      source.connect(this.sfxGainNode);
      source.start(0);
    } catch (error) {
      console.warn(
        `Error playing sound for move '${moveName}'. File missing or corrupt.`,
        error
      );
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
    do {
      nextIndex = Math.floor(Math.random() * musicEntry.length);
    } while (musicEntry.length > 1 && nextIndex === currentTrack);

    this.playSequentialTrack(key, nextIndex);
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
    this.sfxVolume = volume;
    this.sfxGainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
  }
}
