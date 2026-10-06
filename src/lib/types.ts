import type { discs, events } from "./schema";
export type Disc = typeof discs.$inferSelect;
export type DiscEvent = typeof events.$inferSelect;
export type Mold = {
  id: string;
  name: string;
  brand: string;
  category: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
};
export const locations = ["In Bag", "Storage", "Lost", "Other"] as const;
export const categories = [
  "Distance Driver",
  "Hybrid Driver",
  "Control Driver",
  "Midrange",
  "Putter",
  "Other",
] as const;
