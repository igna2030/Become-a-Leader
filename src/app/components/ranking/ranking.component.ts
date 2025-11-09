import { Router } from '@angular/router';
import { UserService } from '../../service/user.service';
import { Ranking } from './../../interface/ranking';
import { RankingService } from './../../service/ranking.service';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// Eliminamos la interfaz ExtendedRanking ya que la interfaz Ranking es suficiente.

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [CommonModule,TranslateModule],
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.css'] 
})
export class RankingComponent {
  rs = inject(RankingService);
  us = inject(UserService);
  router=inject(Router);
  translate = inject(TranslateService);
  rankings: Ranking[] = []; 

  ngOnInit() {
    this.rs.getRankings().subscribe((data) => {
      this.rankings = data as Ranking[]; 
      this.rankings.sort((a, b) => b.puntaje - a.puntaje);
    });
  }

  navegarMenu()
  {
    this.router.navigate(['/menu']);
  }
  logout()
  {
    this.us.logout();
    this.router.navigate(['']);
  }
 
  capitalizeDifficulty(dificultad: 'facil' | 'normal' | undefined): string {
    if (!dificultad) return 'N/A';
    return dificultad.charAt(0).toUpperCase() + dificultad.slice(1);
  }
}