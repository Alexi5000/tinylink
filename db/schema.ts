import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
export const links = sqliteTable(
  "links",
  {
    code: text("code").primaryKey(),
    owner: text("owner").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at"),
    active: integer("active").notNull().default(1),
    clicks: integer("clicks").notNull().default(0),
  },
  (t) => [index("links_owner").on(t.owner)],
);
export const daily = sqliteTable(
  "daily",
  {
    code: text("code")
      .notNull()
      .references(() => links.code, { onDelete: "cascade" }),
    day: text("day").notNull(),
    clicks: integer("clicks").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.code, t.day] })],
);
export const limits = sqliteTable("limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  until: integer("until").notNull(),
});
