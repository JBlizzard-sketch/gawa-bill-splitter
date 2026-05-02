import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const splitTypeEnum = pgEnum("split_type", ["equal", "itemised", "custom"]);
export const eventStatusEnum = pgEnum("event_status", ["draft", "sent", "partial", "settled"]);

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  splitType: splitTypeEnum("split_type").notNull().default("equal"),
  status: eventStatusEnum("status").notNull().default("draft"),
  payerName: text("payer_name").notNull(),
  tripId: integer("trip_id"),
  recurringId: integer("recurring_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
