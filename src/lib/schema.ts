import { sqliteTable, text, real } from "drizzle-orm/sqlite-core";

export const discs = sqliteTable("discs", {
  id: text("id").primaryKey(),
  apiId: text("api_id"),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  plastic: text("plastic").notNull(),
  color: text("color").notNull(),
  weight: real("weight"),
  speed: real("speed"),
  glide: real("glide"),
  turn: real("turn"),
  fade: real("fade"),
  location: text("location").notNull(),
  locationDetail: text("location_detail").notNull(),
  purchasedAt: text("purchased_at"),
  purchasedFrom: text("purchased_from").notNull(),
  lostAt: text("lost_at"),
  notes: text("notes").notNull(),
  photo: text("photo"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  discId: text("disc_id")
    .notNull()
    .references(() => discs.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  location: text("location").notNull(),
  detail: text("detail").notNull(),
  lostAt: text("lost_at"),
  createdAt: text("created_at").notNull(),
});
export const catalogCache = sqliteTable("catalog_cache", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});
