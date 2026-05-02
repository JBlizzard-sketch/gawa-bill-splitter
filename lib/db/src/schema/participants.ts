import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentStatusEnum = pgEnum("payment_status", ["pending", "requested", "paid", "failed"]);

export const participantsTable = pgTable("participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  mpesaPhone: text("mpesa_phone").notNull(),
  shareAmount: numeric("share_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertParticipantSchema = createInsertSchema(participantsTable).omit({ id: true, createdAt: true });
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Participant = typeof participantsTable.$inferSelect;
