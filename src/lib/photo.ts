// Menu photos (item and combo). No object storage: a photo is shrunk in the
// browser to a small JPEG and stored inline as a data:image URL, which the
// backend caps at PHOTO_MAX_CHARS.
export const PHOTO_MAX_PX = 480;
export const PHOTO_MAX_CHARS = 280_000;

export async function photoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PHOTO_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}
