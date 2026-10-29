import { Routes } from '@angular/router';
import { BirthdaysPage } from './birthdays.page';
import { CalendarPage } from './calendar.page';

export const CALENDAR_ROUTES: Routes = [
  { path: '', component: CalendarPage, title: 'Calendario · Hogar' },
  { path: 'cumpleanos', component: BirthdaysPage, title: 'Cumpleaños · Hogar' },
];
