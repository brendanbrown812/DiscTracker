import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { catalogCache } from "@/lib/schema";
import { handle, HttpError, json } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const number = (min: number, max: number) =>
  z.coerce.number().finite().min(min).max(max);
const mold = z.object({
  id: z.string().max(100),
  name: z.string().max(100),
  brand: z.string().max(100),
  category: z.string().max(100),
  speed: number(1, 15),
  glide: number(1, 7),
  turn: number(-5, 1),
  fade: number(0, 5),
});
export async function GET(request: Request) {
  return handle(async () => {
    const raw = (new URL(request.url).searchParams.get("q") || "")
      .trim()
      .slice(0, 100);
    const q = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    if (q.length < 2) return json({ molds: [], cached: false });
    const cached = db()
      .select()
      .from(catalogCache)
      .where(eq(catalogCache.key, q))
      .get();
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < 86400000)
      return json({ molds: JSON.parse(cached.payload), cached: false });
    try {
      const response = await fetch(
        `https://discit-api.fly.dev/disc?name=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(8000), cache: "no-store" },
      );
      if (!response.ok) throw new Error("Catalog unavailable");
      const molds = z
        .array(mold)
        .parse(await response.json())
        .slice(0, 40);
      db()
        .insert(catalogCache)
        .values({
          key: q,
          payload: JSON.stringify(molds),
          fetchedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: catalogCache.key,
          set: {
            payload: JSON.stringify(molds),
            fetchedAt: new Date().toISOString(),
          },
        })
        .run();
      return json({ molds, cached: false });
    } catch {
      if (cached)
        return json({ molds: JSON.parse(cached.payload), cached: true });
      throw new HttpError(
        503,
        "Disc lookup is unavailable right now. You can still enter this disc and its flight numbers manually.",
      );
    }
  });
}
