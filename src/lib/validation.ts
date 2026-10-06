import { z } from "zod";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format")
  .refine((value) => {
    const parsed = new Date(value + "T00:00:00Z");
    return (
      !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid calendar date")
  .nullable();
const optionalNumber = (min: number, max: number) =>
  z.number().finite().min(min).max(max).nullable();
export const discInput = z
  .object({
    apiId: z.string().max(100).nullable(),
    name: z.string().trim().min(1, "A disc name is required").max(100),
    brand: z.string().trim().min(1, "A manufacturer is required").max(100),
    category: z.enum([
      "Distance Driver",
      "Hybrid Driver",
      "Control Driver",
      "Midrange",
      "Putter",
      "Other",
    ]),
    plastic: z.string().trim().max(100),
    color: z.string().trim().max(100),
    weight: optionalNumber(1, 300),
    speed: optionalNumber(1, 15),
    glide: optionalNumber(1, 7),
    turn: optionalNumber(-5, 1),
    fade: optionalNumber(0, 5),
    location: z.enum(["In Bag", "Storage", "Lost", "Other"]),
    locationDetail: z.string().trim().max(200),
    purchasedAt: date,
    purchasedFrom: z.string().trim().max(200),
    lostAt: date,
    notes: z.string().trim().max(3000),
  })
  .superRefine((disc, ctx) => {
    if (disc.location === "Lost" && !disc.lostAt)
      ctx.addIssue({
        code: "custom",
        path: ["lostAt"],
        message: "Choose the date this disc was lost",
      });
  });
export type DiscInput = z.infer<typeof discInput>;
export function parseDisc(value: unknown): DiscInput {
  const result = discInput.parse(value);
  return {
    ...result,
    lostAt: result.location === "Lost" ? result.lostAt : null,
  };
}
