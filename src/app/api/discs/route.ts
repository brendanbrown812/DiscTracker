import { allDiscs, createDisc } from "@/lib/collection";
import { handle, HttpError, json, requireEditor } from "@/lib/http";
import { parseDisc } from "@/lib/validation";
import { removePhoto, savePhoto } from "@/lib/photos";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => json(allDiscs()));
}
export async function POST(request: Request) {
  return handle(async () => {
    await requireEditor(request);
    if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
      throw new HttpError(413, "This upload is too large.");
    const form = await request.formData();
    const input = parseDisc(JSON.parse(String(form.get("data"))));
    const file = form.get("photo");
    const photo =
      file instanceof File && file.size ? await savePhoto(file) : null;
    try {
      return json(createDisc(input, photo), 201);
    } catch (error) {
      await removePhoto(photo);
      throw error;
    }
  });
}
