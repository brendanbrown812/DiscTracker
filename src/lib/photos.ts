import sharp from "sharp";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { dataDir } from "./db";
import { HttpError } from "./http";

export const PHOTO_PATTERN = /^[a-f0-9-]{36}\.jpg$/;
export function photoPath(filename: string) {
  return path.join(dataDir(), "photos", filename);
}
export async function savePhoto(file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw new HttpError(400, "Photos must be smaller than 10 MB.");
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml")
    throw new HttpError(
      400,
      "Choose a JPEG, PNG, WebP, HEIC, or other supported photo.",
    );
  let buffer: Buffer;
  try {
    buffer = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40000000,
    })
      .rotate()
      .resize(1400, 1400, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    throw new HttpError(
      400,
      "This image could not be opened. Try a JPEG, PNG, or WebP photo.",
    );
  }
  const name = `${randomUUID()}.jpg`;
  await mkdir(path.join(dataDir(), "photos"), { recursive: true });
  await writeFile(photoPath(name), buffer);
  return name;
}
export async function removePhoto(name: string | null) {
  if (!name || !PHOTO_PATTERN.test(name)) return;
  try {
    await unlink(photoPath(name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      console.warn("Could not remove old photo:", error);
  }
}
