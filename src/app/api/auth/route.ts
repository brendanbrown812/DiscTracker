import {
  authConfigured,
  canEdit,
  createSession,
  endSession,
  localEditing,
  passwordMatches,
} from "@/lib/auth";
import { checkOrigin, handle, HttpError, json } from "@/lib/http";
export const dynamic = "force-dynamic";
const attempts = globalThis as unknown as {
  discTrackerLoginAttempts?: { count: number; reset: number };
};
export async function GET() {
  return handle(async () =>
    json({
      canEdit: await canEdit(),
      loginAvailable: authConfigured(),
      local: localEditing(),
    }),
  );
}
export async function POST(request: Request) {
  return handle(async () => {
    checkOrigin(request);
    if (!authConfigured())
      throw new HttpError(403, "Owner login has not been configured.");
    const now = Date.now();
    if (
      !attempts.discTrackerLoginAttempts ||
      attempts.discTrackerLoginAttempts.reset < now
    )
      attempts.discTrackerLoginAttempts = { count: 0, reset: now + 60000 };
    if (++attempts.discTrackerLoginAttempts.count > 10)
      throw new HttpError(
        429,
        "Too many attempts. Please wait a minute before trying again.",
      );
    if (Number(request.headers.get("content-length")) > 4096)
      throw new HttpError(413, "Request too large.");
    const data = await request.json();
    if (
      typeof data.password !== "string" ||
      data.password.length > 1000 ||
      !passwordMatches(data.password)
    )
      throw new HttpError(401, "That password was not recognized.");
    await createSession();
    return json({ ok: true });
  });
}
export async function DELETE(request: Request) {
  return handle(async () => {
    checkOrigin(request);
    await endSession();
    return json({ ok: true });
  });
}
