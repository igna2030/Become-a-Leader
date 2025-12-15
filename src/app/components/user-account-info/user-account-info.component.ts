import { Component, Input, OnInit, Output, EventEmitter, inject } from '@angular/core';
import { UserService } from '../../service/user.service';
import { FormsModule } from '@angular/forms';

import { Usuario } from '../../interface/user.interface';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppAudio } from '../app-audio/app-audio';

@Component({
    selector: 'app-user-account-info',
    standalone:true,
    imports: [FormsModule, TranslateModule, AppAudio],
    templateUrl: './user-account-info.component.html',
    styleUrls: ['./user-account-info.component.css']
})
export class UserAccountInfoComponent implements OnInit {
    @Input() userId: string | null = null;
    @Output() profileUpdateCompleted = new EventEmitter<Usuario | null>();

    
    translate = inject(TranslateService); 
    usuario: any = {};

    cambioNickname: boolean = false;
    editarNickname = false;
    nickNameCopy: string = "";
    nickNameErrorMsg: string = "";
    showNickNameErrorMsg: boolean = false;

    mostrarCambioClave = false;
    currentPassword = '';
    newPassword = '';
    confirmNewPassword = '';
    passwordCopy: string = "";
    claveActualIncorrectaMsg: boolean = false;
    claveDistintaALaActualMsg: boolean = false;
    clavesNuevasNoCoincidenMsg: boolean = false;
    claveVaciaMsg: boolean = false;


    editarEmail = false;
    emailEnUso = false;
    emailCopy: string = "";
    emailDistintoAlActualMsg: boolean = false;
    emailEnUsoMsg: boolean = false;
    cambioEmail: boolean = false;
    cambioClave: boolean = false;
    // Nuevo estado: Para el formato de email
    emailFormatoInvalidoMsg: boolean = false; 

    constructor(private userService: UserService) { }

    ngOnInit(): void {
        if (this.userId) {
            this.userService.getUserByID(this.userId).subscribe({
                next: (res) => {
                    this.usuario = res;
                    this.emailCopy = this.usuario.email; 
                    this.nickNameCopy = this.usuario.nick;
                },
                error: (err) => {
                    console.error('Error al obtener el usuario: ' + err + '.');
                }
            });
        } else {
            console.error("Error al encontrar el usuario.");
        }
    }

    cambiarClave(): void {
        this.desactivarAlertasClave();
        if (this.currentPassword === this.usuario.password) { 
            if (this.newPassword === this.confirmNewPassword &&
                this.newPassword !== this.currentPassword &&
                this.newPassword !== ""
            ) {
                this.usuario.password = this.newPassword;
                this.userService.updateUser(this.usuario.id, this.usuario).subscribe({
                    next: () => {
                        console.log("usuario actualizado...");
                        this.mostrarCambioClave = false;
                        this.cambioClave = true;
                        setTimeout(() => {
                            this.cambioClave = false;
                        }, 3000);
                        this.profileUpdateCompleted.emit(this.usuario); 
                    },
                    error: (err) => { console.error("Error al actualizar el usuario: " + err + ".") },
                })
            }
            else {
                if (this.newPassword === this.currentPassword) {
                    this.claveDistintaALaActualMsg = true;
                }
                else if (this.newPassword !== this.confirmNewPassword) {
                    this.clavesNuevasNoCoincidenMsg = true;
                }
                else if (this.newPassword === "") {
                    this.claveVaciaMsg = true;
                }
            }
        }
        else {
            this.claveActualIncorrectaMsg = true;
        }
    }

    cambiarNickName(): void {
        this.showNickNameErrorMsg = false;
        
        if (this.nickNameCopy !== this.usuario.nick && this.nickNameCopy !== "") {
            this.usuario.nick = this.nickNameCopy;
            this.userService.updateUser(this.usuario.id, this.usuario).subscribe({
                next: (res) => {
                    console.log("Nickname actualizado y usuario emitido...");
                    this.usuario = res; 
                    this.cambioNickname = true;
                    this.editarNickname = false;
                    setTimeout(() => {
                        this.cambioNickname = false;
                    }, 3000);
                    
                    this.profileUpdateCompleted.emit(this.usuario); 
                },
                error: (err) => {
                    console.error("error al actualizar el usuario: " + err + ".");
                }
            });
        }
        else {
            if (this.nickNameCopy === "")
                this.nickNameErrorMsg = "alerts.NicknameEmpty";
            else if (this.nickNameCopy === this.usuario.nick)
                this.nickNameErrorMsg = "alerts.NicknameSame";
            
            this.showNickNameErrorMsg = true;
            this.editarNickname = true;
        }
    }

    private esFormatoGmail(email: string): boolean {
        const gmailRegex = /@gmail\.com$/i;
        return gmailRegex.test(email);
    }

    verificarUsoEmail(): void {
        this.desactivarAlertasMail();
        
        if (!this.esFormatoGmail(this.emailCopy)) {
            this.alertMailFormatoInvalido();
            this.emailEnUso = true; // Bloquea el botón de guardar
            return;
        }
        
        if (this.emailCopy === this.usuario.email) {
            this.alertMailDistintoAlActual();
            this.emailEnUso = true; // Bloquea el botón de guardar
            return;
        }
        
        this.userService.getUserByEmail(this.emailCopy).subscribe({
            next: (res: Usuario | null) => {
                if (res) {
                    this.emailEnUso = true;
                    this.alertaMailEnUso();
                } else {
                    this.emailEnUso = false; // Permitir guardar
                }
            },
            error: (err) => {
                console.error("Error al verificar el uso del mail: " + err + ",");
                this.emailEnUso = false;
            }
        });
    }

    cambiarEmail(): void {
        this.desactivarAlertasMail();
        
        if (!this.esFormatoGmail(this.emailCopy)) {
            this.alertMailFormatoInvalido();
            return;
        }

        if (this.emailCopy === this.usuario.email) {
            this.alertMailDistintoAlActual();
            return;
        }

        if (!this.emailEnUso) {
            this.usuario.email = this.emailCopy;
            this.userService.updateUser(this.usuario.id, this.usuario).subscribe({
                next: (res) => {
                    console.log("Email actualizado...");
                    this.usuario = res; 
                    this.editarEmail = false;
                    this.cambioEmail = true;
                    setTimeout(() => {
                        this.cambioEmail = false;
                    }, 3000);
                    
                    this.profileUpdateCompleted.emit(this.usuario); 
                },
                error: (err) => {
                    console.error(err.message);
                }
            });
        } else {
            this.alertaMailEnUso();
        }
    }

    desactivarAlertasClave() {
        this.claveActualIncorrectaMsg = false;
        this.claveDistintaALaActualMsg = false;
        this.clavesNuevasNoCoincidenMsg = false;
        this.claveVaciaMsg = false;
    }

    desactivarAlertasMail() {
        this.emailDistintoAlActualMsg = false;
        this.emailEnUsoMsg = false;
        this.emailFormatoInvalidoMsg = false; // Desactivar la nueva alerta
    }

    alertMailDistintoAlActual(): void {
        this.desactivarAlertasMail();
        this.emailDistintoAlActualMsg = true;
    }

    alertaMailEnUso(): void {
        this.desactivarAlertasMail();
        this.emailEnUsoMsg = true;
    }

    alertMailFormatoInvalido(): void {
        this.desactivarAlertasMail();
        this.emailFormatoInvalidoMsg = true;
    }

    onVolver(): void {
        // Emitir null al volver, indicando al padre que solo cambie la vista.
        this.profileUpdateCompleted.emit(null); 
    }
}