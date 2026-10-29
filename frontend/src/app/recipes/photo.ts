/** Lado mayor de las fotos que se suben: de sobra para verlas en el móvil y en el PC. */
const MAX_SIDE = 1600;

/**
 * Reduce una foto antes de subirla (las del móvil pesan varios MB) y la pasa a JPEG.
 * createImageBitmap ya la endereza según los datos EXIF de la cámara.
 */
export async function resizePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo leer la foto'))), 'image/jpeg', 0.85),
  );
}
