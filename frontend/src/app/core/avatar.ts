import { Directive, input } from '@angular/core';
import { AVATAR_SIDE } from '@hogar/shared';

/**
 * Pone la foto de perfil en un círculo de iniciales (`<span class="avatar" [appAvatar]="m.avatarUrl">AR</span>`).
 * Sin foto se quedan las iniciales con el color de la persona.
 */
@Directive({
  selector: '[appAvatar]',
  host: {
    '[class.has-img]': '!!appAvatar()',
    '[style.background-image]': "appAvatar() ? 'url(' + appAvatar() + ')' : null",
  },
})
export class Avatar {
  readonly appAvatar = input<string | null | undefined>(null);
}

/** Recorta la foto en cuadrado (por el centro) y la reduce a AVATAR_SIDE px, en JPEG. */
export async function resizeAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(AVATAR_SIDE, side);
  canvas
    .getContext('2d')!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo leer la foto'))), 'image/jpeg', 0.88),
  );
}
