import { ZodError } from "zod";
import { canEdit } from "./auth";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = [new URL(request.url).origin];
  // Next may construct request.url using localhost behind a loopback proxy.
  // Match the browser's actual Host as well; do not trust forwarded headers.
  const host = request.headers.get("host");
  if (host) allowed.push(`${new URL(request.url).protocol}//${host}`);
  if (process.env.APP_URL) allowed.push(new URL(process.env.APP_URL).origin);
  if (!origin || !allowed.includes(origin))
    throw new HttpError(403, "This request must come from DiscTracker.");
}
export async function requireEditor(request: Request) {
  checkOrigin(request);
  if (!(await canEdit()))
    throw new HttpError(401, "Sign in as the owner to make changes.");
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function handle(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof ZodError)
      return json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    if (error instanceof SyntaxError)
      return json({ error: "The submitted data could not be read." }, 400);
    console.error("DiscTracker request failed:", error);
    return json(
      {
        error: "Something went wrong saving your collection. Please try again.",
      },
      500,
    );
  }
}
