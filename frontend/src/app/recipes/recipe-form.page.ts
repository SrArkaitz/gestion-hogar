import { Component, OnDestroy, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  Ingredient,
  INGREDIENT_NAME_MAX,
  INGREDIENT_TEXT_MAX,
  INGREDIENTS_MAX,
  RECIPE_DURATION_LABELS,
  RECIPE_DURATIONS,
  RECIPE_KIND_LABELS,
  RECIPE_KINDS,
  RECIPE_MINUTES_MAX,
  RECIPE_NAME_MAX,
  RECIPE_NOTES_MAX,
  RECIPE_SERVINGS_MAX,
  RecipeDuration,
  RecipeInput,
  RecipeKind,
  STEP_MAX,
  STEPS_MAX,
  Unit,
  UNIT_LABELS,
  UNITS,
} from '@hogar/shared';
import { errorMessage } from '../core/errors';
import { SessionService } from '../core/session.service';
import { resizePhoto } from './photo';
import { RecipesStore } from './recipes.store';

/** Fila del formulario: la cantidad se escribe como texto ("200", "1,5", "1/2" o "al gusto"). */
interface IngredientRow {
  name: string;
  qty: string;
  unit: Unit | '';
}

const NUMBER_RE = /^\d+(?:[.,]\d+)?$/;
const FRACTION_RE = /^(\d+)\/(\d+)$/;

/** Número escrito a mano: "1,5", "2" o "1/2". null si no es un número. */
function parseAmount(text: string): number | null {
  const t = text.trim();
  if (NUMBER_RE.test(t)) return Number(t.replace(',', '.'));
  const f = FRACTION_RE.exec(t);
  return f && Number(f[2]) ? Number(f[1]) / Number(f[2]) : null;
}

/** Crear o editar una receta (sin :id en la ruta, es nueva). */
@Component({
  selector: 'app-recipe-form-page',
  imports: [FormsModule, RouterLink],
  host: { class: 'view' },
  templateUrl: './recipe-form.page.html',
})
export class RecipeFormPage implements OnDestroy {
  protected readonly store = inject(RecipesStore);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  /** :id de la ruta al editar. */
  readonly id = input<string>();

  protected readonly kinds = RECIPE_KINDS;
  protected readonly kindLabels = RECIPE_KIND_LABELS;
  protected readonly durations = RECIPE_DURATIONS;
  protected readonly durationLabels = RECIPE_DURATION_LABELS;
  protected readonly units = UNITS;
  protected readonly unitLabels = UNIT_LABELS;
  protected readonly max = {
    name: RECIPE_NAME_MAX,
    servings: RECIPE_SERVINGS_MAX,
    minutes: RECIPE_MINUTES_MAX,
    ingredients: INGREDIENTS_MAX,
    ingredientName: INGREDIENT_NAME_MAX,
    ingredientText: INGREDIENT_TEXT_MAX,
    steps: STEPS_MAX,
    step: STEP_MAX,
    notes: RECIPE_NOTES_MAX,
  };

  /** Solo se editan las de esta casa; las públicas de otras no se encuentran aquí. */
  protected readonly recipe = computed(() => (this.id() ? (this.store.own().find((r) => r.id === this.id()) ?? null) : null));

  protected readonly name = signal('');
  protected readonly kind = signal<RecipeKind>('unico');
  protected readonly duration = signal<RecipeDuration>('medio');
  protected readonly minutes = signal<number | null>(null);
  protected readonly servings = signal<number | null>(2);
  protected readonly rows = signal<IngredientRow[]>([{ name: '', qty: '', unit: 'g' }]);
  protected readonly steps = signal<string[]>(['']);
  protected readonly notes = signal('');
  protected readonly isPrivate = signal(false);

  /** Foto nueva elegida (ya reducida) y su vista previa; o la decisión de quitar la que había. */
  protected readonly newPhoto = signal<Blob | null>(null);
  protected readonly newPhotoUrl = signal<string | null>(null);
  protected readonly dropPhoto = signal(false);
  protected readonly photoShown = computed(() => {
    if (this.newPhotoUrl()) return this.newPhotoUrl();
    const r = this.recipe();
    return r && !this.dropPhoto() ? this.store.photoUrl(r) : null;
  });

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private loadedId: string | null = null;

  constructor() {
    effect(() => {
      const id = this.session.household()?.id;
      if (id) this.store.load(id);
    });
    // Al editar, rellena el formulario cuando llega la receta (una sola vez).
    effect(() => {
      const r = this.recipe();
      if (!r || this.loadedId === r.id) return;
      this.loadedId = r.id;
      untracked(() => {
        this.name.set(r.name);
        this.kind.set(r.kind);
        this.duration.set(r.duration);
        this.minutes.set(r.minutes);
        this.servings.set(r.servings);
        this.rows.set(
          r.ingredients.length
            ? r.ingredients.map((i) => ({
                name: i.name,
                qty: i.amount !== null ? String(+i.amount.toFixed(3)).replace('.', ',') : (i.text ?? ''),
                unit: i.unit ?? '',
              }))
            : [{ name: '', qty: '', unit: 'g' }],
        );
        this.steps.set(r.steps.length ? [...r.steps] : ['']);
        this.notes.set(r.notes);
        this.isPrivate.set(r.private);
      });
    });
  }

  ngOnDestroy() {
    const url = this.newPhotoUrl();
    if (url) URL.revokeObjectURL(url);
  }

  protected isNumber(text: string): boolean {
    return parseAmount(text) !== null;
  }

  // --- Ingredientes ---
  protected addRow() {
    this.rows.update((rows) => [...rows, { name: '', qty: '', unit: 'g' }]);
    setTimeout(() => document.querySelector<HTMLInputElement>('.ing-row:last-child .ing-name')?.focus());
  }

  protected removeRow(i: number) {
    this.rows.update((rows) => rows.filter((_, j) => j !== i));
  }

  protected moveRow(i: number, delta: number) {
    this.rows.update((rows) => move(rows, i, delta));
  }

  protected touchRows() {
    this.rows.update((rows) => [...rows]);
  }

  // --- Pasos ---
  protected addStep() {
    this.steps.update((steps) => [...steps, '']);
    setTimeout(() => document.querySelector<HTMLTextAreaElement>('.step-row:last-child textarea')?.focus());
  }

  protected setStep(i: number, text: string) {
    this.steps.update((steps) => steps.map((s, j) => (j === i ? text : s)));
  }

  protected removeStep(i: number) {
    this.steps.update((steps) => steps.filter((_, j) => j !== i));
  }

  protected moveStep(i: number, delta: number) {
    this.steps.update((steps) => move(steps, i, delta));
  }

  // --- Foto ---
  protected async pickPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set('');
    try {
      const blob = await resizePhoto(file);
      const old = this.newPhotoUrl();
      if (old) URL.revokeObjectURL(old);
      this.newPhoto.set(blob);
      this.newPhotoUrl.set(URL.createObjectURL(blob));
      this.dropPhoto.set(false);
    } catch {
      this.error.set('No se pudo leer esa foto. Prueba con otra (JPG o PNG).');
    }
  }

  protected removePhoto() {
    const old = this.newPhotoUrl();
    if (old) URL.revokeObjectURL(old);
    this.newPhoto.set(null);
    this.newPhotoUrl.set(null);
    this.dropPhoto.set(true);
  }

  // --- Guardar y borrar ---
  protected async save() {
    if (this.busy()) return;
    const input = this.collect();
    if (typeof input === 'string') {
      this.error.set(input);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const existing = this.recipe();
      let recipe = existing ? await this.store.update(existing.id, input) : await this.store.create(input);
      const photo = this.newPhoto();
      if (photo) recipe = await this.store.setPhoto(recipe.id, photo);
      else if (this.dropPhoto() && recipe.photo) recipe = await this.store.removePhoto(recipe.id);
      this.router.navigate(['/recetas', recipe.id]);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo guardar. Revisa la conexión y vuelve a intentarlo.'));
      this.busy.set(false);
    }
  }

  protected async remove() {
    const r = this.recipe();
    if (!r || !confirm(`¿Borrar «${r.name}»? Si está en el menú, también se quitará de allí.`)) return;
    this.busy.set(true);
    try {
      await this.store.remove(r.id);
      this.router.navigate(['/recetas']);
    } catch (err) {
      this.error.set(errorMessage(err, 'No se pudo borrar.'));
      this.busy.set(false);
    }
  }

  /** Datos para la API, o el mensaje de lo que falta. */
  private collect(): RecipeInput | string {
    const name = this.name().trim();
    if (!name) return 'Ponle un nombre a la receta.';
    const servings = this.servings();
    if (!servings || servings < 1) return 'Indica para cuántas raciones es.';
    const ingredients: Ingredient[] = this.rows()
      .filter((r) => r.name.trim())
      .map((r) => {
        const amount = parseAmount(r.qty);
        return {
          name: r.name.trim(),
          amount,
          unit: amount !== null && r.unit ? r.unit : null,
          text: amount === null ? r.qty.trim() || null : null,
        };
      });
    return {
      name,
      kind: this.kind(),
      duration: this.duration(),
      minutes: this.minutes() || null,
      servings,
      ingredients,
      steps: this.steps().map((s) => s.trim()).filter(Boolean),
      notes: this.notes().trim(),
      private: this.isPrivate(),
    };
  }
}

function move<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
