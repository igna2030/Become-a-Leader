import { Router } from '@angular/router';
import { UserService } from '../../service/user.service';
import { Ranking } from './../../interface/ranking';
import { RankingService } from './../../service/ranking.service';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AudioService } from '../../service/audio-service';
import { AppAudio } from '../app-audio/app-audio';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [CommonModule, TranslateModule,AppAudio],
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.css']
})
export class RankingComponent {
  //servicios
  rs = inject(RankingService);
  us = inject(UserService);
  router = inject(Router);
  translate = inject(TranslateService);
  audio_service = inject(AudioService);
  //interfaz
  rankings: Ranking[] = [];

  ngOnInit() {
    //consigue los rankings
    this.rs.getRankings().subscribe((data) => {
      this.rankings = data as Ranking[];
      //los arregla por puntaje
      this.rankings.sort((a, b) => b.puntaje - a.puntaje);
      // suena la música si se reinicia la pagina
      this.audio_service.playBGM("intro");
    });
  }

  navegarMenu() {
    this.router.navigate(['/menu']);
  }
  logout() {
    this.us.logout();
    this.router.navigate(['']);
  }

}