import { Component, OnInit, inject, signal } from '@angular/core';
import { errorMessage } from '../core/errors';
import { InstallService } from '../core/install.service';
import { PushClientService } from '../core/push.service';
import { THEME_LABELS, THEMES, ThemeService } from '../core/theme.service';

/** Ajustes que se guardan en cada dispositivo y no en la cuenta: tema, avisos e instalar la app. */
@Component({
  selector: 'section[appDevicePanel]',
  host: { class: 'panel' },
  template: `
    <h2>Este dispositivo</h2>

    <div class="device-row">
      <h3 id="theme-lbl">Tema</h3>
      <div class="seg" role="group" aria-labelledby="theme-lbl">
        @for (t of themes; track t) {
          <button type="button" [attr.aria-pressed]="theme.theme() === t" (click)="theme.set(t)">{{ themeLabels[t] }}</button>
        }
      </div>
    </div>

    <div class="device-block">
      <h3>Avisos</h3>
      @switch (push.state()) {
        @case ('cargando') {
          <p class="n">Comprobando…</p>
        }
        @case ('no-soportado') {
          <p class="n">Este navegador no puede recibir avisos.</p>
        }
        @case ('instalar-primero') {
          <p class="n">En iPhone y iPad, los avisos solo llegan a la app instalada. Instálala (abajo) y actívalos desde ella.</p>
        }
        @case ('bloqueado') {
          <p class="n">Los avisos están bloqueados para esta web. Permítelos en los ajustes del navegador y vuelve aquí.</p>
        }
        @case ('desactivado') {
          <p class="n">Recibe a las 9:00 las tareas que vencen y un aviso cuando alguien te asigne una.</p>
          <button type="button" class="btn" [disabled]="busy()" (click)="enable()">Activar avisos</button>
        }
        @case ('activado') {
          <p class="n">Activados: a las 9:00 te llegan las tareas que vencen, y un aviso cuando alguien te asigna una.</p>
          <div class="acts-sm">
            <button type="button" class="link" [disabled]="busy()" (click)="test()">Enviar uno de prueba</button>
            <button type="button" class="link danger" [disabled]="busy()" (click)="disable()">Desactivar</button>
          </div>
        }
      }
      @if (message()) {
        <p class="status" [class.err]="isError()" role="status">{{ message() }}</p>
      }
    </div>

    <div class="device-block">
      <h3>App</h3>
      @if (install.installed()) {
        <p class="n">Instalada: ábrela desde el icono de Hogar.</p>
      } @else if (install.canPrompt()) {
        <p class="n">Instálala para abrirla como una app más, a pantalla completa.</p>
        <button type="button" class="btn ghost" (click)="install.install()">Instalar en este dispositivo</button>
      } @else if (install.isIos) {
        <p class="n">En Safari, toca Compartir y luego «Añadir a pantalla de inicio».</p>
      } @else {
        <p class="n">Para instalarla, busca «Instalar app» o «Añadir a pantalla de inicio» en el menú del navegador.</p>
      }
    </div>
  `,
})
export class DevicePanel implements OnInit {
  protected readonly theme = inject(ThemeService);
  protected readonly push = inject(PushClientService);
  protected readonly install = inject(InstallService);

  protected readonly themes = THEMES;
  protected readonly themeLabels = THEME_LABELS;

  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly isError = signal(false);

  ngOnInit() {
    this.push.refresh().catch(() => this.push.state.set('desactivado'));
  }

  protected async enable() {
    await this.run(async () => {
      const granted = await this.push.enable();
      return granted ? 'Avisos activados en este dispositivo.' : '';
    });
  }

  protected async disable() {
    await this.run(async () => {
      await this.push.disable();
      return 'Avisos desactivados en este dispositivo.';
    });
  }

  protected async test() {
    await this.run(async () => {
      const sent = await this.push.test();
      return sent
        ? `Aviso de prueba enviado a ${sent === 1 ? 'tu dispositivo' : `tus ${sent} dispositivos`}.`
        : 'No ha llegado a ningún dispositivo. Desactiva y vuelve a activar los avisos.';
    });
  }

  private async run(action: () => Promise<string>) {
    this.busy.set(true);
    this.message.set('');
    this.isError.set(false);
    try {
      this.message.set(await action());
    } catch (err) {
      this.isError.set(true);
      this.message.set(errorMessage(err, 'No se pudo. Vuelve a intentarlo.'));
    } finally {
      this.busy.set(false);
    }
  }
}
