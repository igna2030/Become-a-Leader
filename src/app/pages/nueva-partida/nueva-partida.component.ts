import { Entrenador } from '../../interface/entrenador';
import { Component, inject, OnInit } from '@angular/core';
import { PartidaService } from '../../service/partida.service'; // Asegúrate de tener este servicio creado
import { UserService } from '../../service/user.service';
import { Partida } from '../../interface/partida.js';  // Asegúrate de tener esta interfaz creada
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Pokemon } from '../../interface/pokemon';
import { TeamService } from '../../service/team.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppAudio } from '../../components/app-audio/app-audio';

@Component({
    selector: 'app-nueva-partida',
    imports: [FormsModule, TranslateModule, AppAudio],
    templateUrl: './nueva-partida.component.html',
    styleUrl: './nueva-partida.component.css'
})
export class NuevaPartidaComponent implements OnInit {
  //servicios
  ts = inject(TeamService);
  translate = inject(TranslateService);

  // Datos del formulario
  datos_partida: any = {
    nick: '',
    leader: '',
    tipo: '',
  };

  nuevaPartida: Partida = {
    id: '',
    fecha_inicio: new Date(),
    fecha_fin: new Date(),
    puntuacion: 0,
    personaje: {
      id: '',
      nombre: '',
      tipo: '',
      equipo: []
    }
  }

  // Variables de control
  selectedLider: string = '';
  id: string = '';
  constructor(private partidaService: PartidaService) { }
  router = inject(Router);
  
  us = inject(UserService);
  ngOnInit(): void {
    this.id = localStorage.getItem('token')!;
  }
  // Método que se ejecuta cuando el formulario es enviado
  crearPartida() {
    const cargarEquipo: Pokemon[] = [];
    const userId = this.id; // Obtenemos el ID del usuario

    this.ts.getPokemonsByType(this.datos_partida.tipo).subscribe({
      next: (pokemons: Pokemon[]) => {
        console.log('Pokemons de tipo', this.datos_partida.tipo, 'obtenidos:', pokemons);
        const pokemonsBarajados = this.shuffleArray(pokemons);
        const equipoSeleccionado = pokemonsBarajados.slice(0, 6);
        equipoSeleccionado.forEach(pokemon => {
          const pokemonParaEquipo = { ...pokemon, idEntrenador: userId };
          cargarEquipo.push(pokemonParaEquipo);
        });
        this.nuevaPartida.personaje.equipo = cargarEquipo;
        this.nuevaPartida.personaje.id = userId;
        this.nuevaPartida.id = userId; // Asumimos que el ID de la partida es el ID del usuario
        this.nuevaPartida.personaje.nombre = this.datos_partida.nick;
        this.nuevaPartida.personaje.tipo = this.datos_partida.tipo;

        //  Guardamos la partida
        this.guardarPartidaEnBD(this.nuevaPartida);
      },
      error: (error: Error) => {
        console.error('Error obteniendo Pokemons', error);
      }
    });
  }


  private shuffleArray(array: any[]): any[] {
    const newArray = [...array]; // Creamos una copia para no modificar el original
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; // Intercambio
    }
    return newArray;
  }

  guardarPartidaEnBD(partida: Partida) {
    this.partidaService.postPartida(partida).subscribe({
      next: (partida) => {
        console.log('Partida creada en la BD', partida);
        this.router.navigate(['/batalla']);
      },
      error: (error: Error) => {
        console.error('Error al crear la partida en la BD', error);
      }
    })
  }

  // Seleccionar el líder y actualizar la interfaz
  seleccionarLider(event: any) {
    this.selectedLider = event.target.value;
  }

  navegarMenu() {
    this.router.navigate(['/menu']);
  }
  logout() {
    this.us.logout();
    this.router.navigate(['']);
  }
}
