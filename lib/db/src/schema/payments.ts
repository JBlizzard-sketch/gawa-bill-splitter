import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentTxStatusEnum = pgEnum("payment_tx_status", ["initiated", "success", "failed", "cancelled"]);

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  participantId: integer("participant_id").notNull(),
  participantName: text("participant_name").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  mpesaPhone: text("mpesa_phone").notNull(),
  status: paymentTxStatusEnum("status").notNull().default("initiated"),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  checkoutRequestId: text("checkout_request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
