/** Largest side of a stored device photo, px (matches the built-in photos in public/devices/). */
export const PHOTO_MAX_PX = 480
/** Largest image file accepted before resizing. */
export const PHOTO_MAX_FILE_BYTES = 10_000_000

export class PhotoError extends Error {}

/**
 * Turn a user's image file into a small JPEG data URL (≤ PHOTO_MAX_PX on its longest side, white
 * background for transparent images), so a device photo costs tens of kB in storage.
 */
export async function photoFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new PhotoError('Choose an image file (JPEG, PNG or WebP).')
  if (file.size > PHOTO_MAX_FILE_BYTES) throw new PhotoError('This image is too large (limit 10 MB).')
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    throw new PhotoError('This image could not be read.')
  }
  const scale = Math.min(1, PHOTO_MAX_PX / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoError('This image could not be read.')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}
