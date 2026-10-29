import { Routes } from '@angular/router';
import { MenuPage } from './menu.page';
import { RecipeFormPage } from './recipe-form.page';
import { RecipePage } from './recipe.page';
import { RecipesPage } from './recipes.page';

export const RECIPES_ROUTES: Routes = [
  { path: '', component: RecipesPage, title: 'Recetas · Hogar' },
  { path: 'menu', component: MenuPage, title: 'Menú semanal · Hogar' },
  { path: 'nueva', component: RecipeFormPage, title: 'Nueva receta · Hogar' },
  { path: ':id', component: RecipePage, title: 'Receta · Hogar' },
  { path: ':id/editar', component: RecipeFormPage, title: 'Editar receta · Hogar' },
];
