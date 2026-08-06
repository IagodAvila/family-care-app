"use client";

/**
 * Client-side photo processing for relative profile pictures: downscales
 * and re-encodes to JPEG in the browser (canvas) before it ever leaves the
 * device, so a phone photo (often several MB) turns into a small data URI
 * that fits comfortably in a D1 row — see `validatePhotoUrl` in
 * db/validation.ts for the size cap enforced server-side.
 */

const MAX_DIMENSION = 480;
const JPEG_QUALITY = 0.82;
export const MAX_PHOTO_FILE_SIZE = 12 * 1024 * 1024;

export async function resizePhotoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível processar a imagem.");
    context.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
