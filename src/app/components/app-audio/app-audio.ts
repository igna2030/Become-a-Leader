
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AudioService } from '../../service/audio-service';
import { TranslateModule, TranslateNoOpLoader, TranslateService } from '@ngx-translate/core';
@Component({
    selector: 'app-app-audio',
    standalone:true,
    imports: [TranslateModule],
    templateUrl: './app-audio.html',
    styleUrl: './app-audio.css'
})
export class AppAudio {

  //servicio
  audio_service = inject(AudioService);
  translate_service = inject(TranslateService)
  //cambio por parte de usuario del sonido
  bgmVolume: number = this.audio_service.getBGMVolume();
  sfxVolume: number = this.audio_service.getsfxVolume();

  public setBGMVolume(event: Event): void {
    const target = event.target as HTMLInputElement;
    const newVolume = parseFloat(target.value);

    this.bgmVolume = newVolume;

    this.audio_service.setBGMVolume(newVolume);
  }

}
