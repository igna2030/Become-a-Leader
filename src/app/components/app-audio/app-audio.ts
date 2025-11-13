import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AudioService } from '../../service/audio-service';
import { TranslateModule, TranslateNoOpLoader, TranslateService } from '@ngx-translate/core';
@Component({
  selector: 'app-app-audio',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './app-audio.html',
  styleUrl: './app-audio.css',
})
export class AppAudio {
  sfxVolume: number = 0.8;
  audio_service = inject(AudioService);
  bgmVolume: number = this.audio_service.getBGMVolume();

  translate_service = inject(TranslateService)
  public setBGMVolume(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newVolume = parseFloat(target.value);

    this.bgmVolume = newVolume;

    this.audio_service.setBGMVolume(newVolume);
  }

}
