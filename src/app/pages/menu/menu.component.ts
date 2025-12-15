import { Component, inject, OnInit } from '@angular/core';

import { UserService } from '../../service/user.service';
import { Router, RouterModule } from '@angular/router';
import { PartidaService } from '../../service/partida.service';
import { Partida } from '../../interface/partida.js';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AudioService } from '../../service/audio-service';
import { AppAudio } from '../../components/app-audio/app-audio';

@Component({
    selector: 'app-menu',
    standalone:true,
    imports: [TranslateModule, RouterModule, AppAudio],
    templateUrl: './menu.component.html',
    styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  //interfaces
  usuario: any;
  partida: Partida | null = null;
  //boolean
  tienePartida: boolean = false;
  //servicios
    translate = inject(TranslateService);
    audio_service = inject(AudioService)

  constructor(
    private userService: UserService,
    private partidaService: PartidaService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const token = localStorage.getItem('token');
    if (token) {
      this.userService.getUserByID(token).subscribe(usuario => {
        this.usuario = usuario;
        if (this.usuario) {
          this.partidaService.getPartidaByUserId(this.usuario.id).subscribe( {
            next: (partida: Partida | null) => {
              this.partida = partida;
              this.tienePartida = !!partida;
              this.audio_service.playBGM("intro")
            },
            error: () => {
              
            }

          });
        }
      });
    }
  }

  onSeleccionarPartida(): void {
    if (this.tienePartida) {
      this.router.navigate(['/batalla']);
    } else {
      this.router.navigate(['/nueva-partida']);
    }
  }

  onNuevaPartida(): void {
    if (this.tienePartida) {
      const confirmacion = confirm(
        this.translate.instant("alerts.saveAlreadyExits")
      );
      if (confirmacion) {
        this.eliminarPartida();
      }
    } else {
      this.router.navigate(['/nueva-partida']);
    }
  }
  verRanking(): void {
    this.router.navigate(['/ranking']);
  }

  verPerfil():void{
    this.router.navigate(['/perfil']);
  }

  eliminarPartida(): void {
    if (this.partida && this.usuario) {
      this.partidaService.eliminarPartida(this.usuario.id).subscribe({
        next: () => {
          this.partida = null;
          this.tienePartida = false;
          this.router.navigate(['/nueva-partida']);
        },
        error: (error: Error) => {
          console.error(this.translate.instant("alerts.deletingSave"), error);
          this.router.navigate(['/nueva-partida']) // El juego debe permitir la creación de una partida en caso de que no exista una.
        },
      });
    }
  }

  logout()
  {
    this.userService.logout();
    this.router.navigate(['']);
  }


}

