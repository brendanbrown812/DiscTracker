import { allDiscs, discHistory } from "@/lib/collection";
import { canEdit } from "@/lib/auth";
import { handle, HttpError } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => {
    if (!(await canEdit()))
      throw new HttpError(401, "Sign in to export your collection.");
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      discs: allDiscs().map((disc) => ({
        ...disc,
        history: discHistory(disc.id),
      })),
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="disctracker-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
