import { Routes } from '@angular/router';
import { EquipmentPage } from './equipment.page';
import { ItemsPage } from './items.page';

export const INVENTORY_ROUTES: Routes = [
  { path: '', component: ItemsPage, title: 'Inventario · Hogar' },
  { path: 'equipos', component: EquipmentPage, title: 'Equipos y garantías · Hogar' },
];
