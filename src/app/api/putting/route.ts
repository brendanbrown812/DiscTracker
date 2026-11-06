import { z } from "zod";
import { handle, HttpError, json, requireEditor } from "@/lib/http";
import {
  createPractice,
  listPractice,
  updatePractice,
} from "@/lib/putting-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => json(listPractice()));
}
async function body(request: Request) {
  const text = await request.text();
  if (text.length > 50000)
    throw new HttpError(413, "Practice data is too large.");
  return JSON.parse(text);
}
export async function POST(request: Request) {
  return handle(async () => {
    await requireEditor(request);
    return json(createPractice(await body(request)), 201);
  });
}
export async function PATCH(request: Request) {
  return handle(async () => {
    await requireEditor(request);
    const data = z
      .object({
        id: z.string().uuid(),
        revision: z.number().int().nonnegative(),
        rounds: z.unknown(),
      })
      .parse(await body(request));
    return json(updatePractice(data.id, data.revision, data.rounds));
  });
}
