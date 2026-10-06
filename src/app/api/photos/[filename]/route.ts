import { readFile } from "node:fs/promises";
import { PHOTO_PATTERN, photoPath } from "@/lib/photos";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  if (!PHOTO_PATTERN.test(filename))
    return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(photoPath(filename));
    return new Response(data, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
