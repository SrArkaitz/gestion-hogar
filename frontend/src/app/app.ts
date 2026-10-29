import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  // Se crea al arrancar para seguir los cambios de tema del dispositivo desde cualquier página.
  private readonly theme = inject(ThemeService);
}
