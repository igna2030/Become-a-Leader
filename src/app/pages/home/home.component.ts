
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AudioService } from '../../service/audio-service';
import { AppAudio } from '../../components/app-audio/app-audio';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule,CommonModule,TranslateModule,AppAudio],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

  translate = inject(TranslateService);
  audio_service = inject(AudioService);
  private audioStarted = false;
  changeLang(lang:string){
    this.translate.use(lang);
    console.log("Language changed to: ",lang);
    localStorage.setItem('appLang', lang);
  }

  toogleLang(){
    const current_lang = this.translate.getCurrentLang();
    const new_lang = current_lang === 'en' ? 'es' : 'es';
    this.translate.use(new_lang);
  }

  public handleUserGesture() {
    if (!this.audioStarted) {
      this.audio_service.resumeContext(); 
      this.audio_service.playBGM("intro");
      this.audioStarted = true;
    }
  }

  ngOnInit()
  {
    this.audio_service.resumeContext();
    this.audio_service.playBGM("intro");
  }


}
