import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const billItemsTable = pgTable("bill_items", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBillItemSchema = createInsertSchema(billItemsTable).omit({ id: true, createdAt: true });
export type InsertBillItem = z.infer<typeof insertBillItemSchema>;
export type BillItem = typeof billItemsTable.$inferSelect;
