import { deleteDisc, discHistory, getDisc, updateDisc } from "@/lib/collection";
import { handle, HttpError, json, requireEditor } from "@/lib/http";
import { parseDisc } from "@/lib/validation";
import { removePhoto, savePhoto } from "@/lib/photos";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, context: Context) {
  return handle(async () => {
    const { id } = await context.params;
    const disc = getDisc(id);
    if (!disc)
      throw new HttpError(404, "This disc is no longer in your collection.");
    return json({ disc, history: discHistory(id) });
  });
}
export async function PUT(request: Request, context: Context) {
  return handle(async () => {
    await requireEditor(request);
    const { id } = await context.params;
    const previous = getDisc(id);
    if (!previous)
      throw new HttpError(404, "This disc is no longer in your collection.");
    if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
      throw new HttpError(413, "This upload is too large.");
    const form = await request.formData();
    const input = parseDisc(JSON.parse(String(form.get("data"))));
    const file = form.get("photo");
    const uploaded =
      file instanceof File && file.size ? await savePhoto(file) : null;
    const photo =
      uploaded || (form.get("removePhoto") === "true" ? null : previous.photo);
    let result;
    try {
      result = updateDisc(id, input, photo);
    } catch (error) {
      await removePhoto(uploaded);
      throw error;
    }
    if (photo !== previous.photo) await removePhoto(previous.photo);
    return json(result);
  });
}
export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    await requireEditor(request);
    const { id } = await context.params;
    const previous = getDisc(id);
    if (!previous)
      throw new HttpError(404, "This disc is no longer in your collection.");
    deleteDisc(id);
    await removePhoto(previous.photo);
    return json({ ok: true });
  });
}
