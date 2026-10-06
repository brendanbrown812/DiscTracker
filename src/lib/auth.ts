import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "disctracker_owner";
const HOURS = 60 * 60 * 12;
export function authConfigured() {
  return (
    !!process.env.ADMIN_PASSWORD &&
    (process.env.SESSION_SECRET?.length ?? 0) >= 32
  );
}
export function localEditing() {
  return process.env.NODE_ENV === "development" && !process.env.ADMIN_PASSWORD;
}
function signature(value: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || "")
    .update(`${process.env.ADMIN_PASSWORD || ""}\0${value}`)
    .digest("hex");
}
function equal(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function validSession(token: string | undefined) {
  if (!authConfigured() || !token) return false;
  const [expires, nonce, sig, extra] = token.split(".");
  return (
    !extra &&
    !!nonce &&
    /^\d+$/.test(expires) &&
    Number(expires) > Date.now() &&
    equal(sig || "", signature(`${expires}.${nonce}`))
  );
}
export async function canEdit() {
  return localEditing() || validSession((await cookies()).get(COOKIE)?.value);
}
export function passwordMatches(password: string) {
  const digest = (v: string) =>
    createHmac("sha256", process.env.SESSION_SECRET || "")
      .update(v)
      .digest();
  return (
    authConfigured() &&
    timingSafeEqual(digest(password), digest(process.env.ADMIN_PASSWORD || ""))
  );
}
export async function createSession() {
  const value = `${Date.now() + HOURS * 1000}.${randomBytes(24).toString("hex")}`;
  (await cookies()).set(COOKIE, `${value}.${signature(value)}`, {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith("https://") || false,
    sameSite: "strict",
    path: "/",
    maxAge: HOURS,
  });
}
export async function endSession() {
  (await cookies()).delete(COOKIE);
}
