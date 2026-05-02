import { pgTable, text, serial, timestamp, integer, numeric, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recurringFrequencyEnum = pgEnum("recurring_frequency", ["weekly", "monthly", "custom"]);
export const recurringSplitTypeEnum = pgEnum("recurring_split_type", ["equal", "custom"]);

export const recurringBillsTable = pgTable("recurring_bills", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  frequency: recurringFrequencyEnum("frequency").notNull().default("monthly"),
  dayOfMonth: integer("day_of_month"),
  participants: text("participants").notNull(),
  splitType: recurringSplitTypeEnum("split_type").notNull().default("equal"),
  payerName: text("payer_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  nextFireAt: timestamp("next_fire_at", { withTimezone: true }),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRecurringBillSchema = createInsertSchema(recurringBillsTable).omit({ id: true, createdAt: true });
export type InsertRecurringBill = z.infer<typeof insertRecurringBillSchema>;
export type RecurringBill = typeof recurringBillsTable.$inferSelect;
