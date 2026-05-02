import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, recurringBillsTable, eventsTable, participantsTable, activityLogTable } from "@workspace/db";
import {
  CreateRecurringBody,
  UpdateRecurringParams,
  UpdateRecurringBody,
  DeleteRecurringParams,
  FireRecurringParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeRecurring(r: typeof recurringBillsTable.$inferSelect) {
  return { ...r, amount: parseFloat(String(r.amount)) };
}

function computeNextFireAt(frequency: string, dayOfMonth: number | null): Date {
  const now = new Date();
  if (frequency === "weekly") {
    const next = new Date(now);
    next.setDate(now.getDate() + 7);
    return next;
  }
  if (frequency === "monthly") {
    const next = new Date(now);
    next.setMonth(now.getMonth() + 1);
    if (dayOfMonth) next.setDate(dayOfMonth);
    return next;
  }
  const next = new Date(now);
  next.setMonth(now.getMonth() + 1);
  return next;
}

router.get("/recurring", async (_req, res): Promise<void> => {
  const recurring = await db.select().from(recurringBillsTable).orderBy(sql`${recurringBillsTable.createdAt} DESC`);
  res.json(recurring.map(serializeRecurring));
});

router.post("/recurring", async (req, res): Promise<void> => {
  const parsed = CreateRecurringBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const nextFireAt = computeNextFireAt(parsed.data.frequency, parsed.data.dayOfMonth ?? null);
  const [recurring] = await db.insert(recurringBillsTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    amount: String(parsed.data.amount),
    frequency: parsed.data.frequency,
    dayOfMonth: parsed.data.dayOfMonth ?? null,
    participants: parsed.data.participants,
    splitType: parsed.data.splitType,
    payerName: parsed.data.payerName,
    isActive: true,
    nextFireAt,
  }).returning();
  res.status(201).json(serializeRecurring(recurring));
});

router.patch("/recurring/:id", async (req, res): Promise<void> => {
  const params = UpdateRecurringParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateRecurringBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Partial<typeof recurringBillsTable.$inferInsert> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
  if (parsed.data.amount != null) updates.amount = String(parsed.data.amount);
  if (parsed.data.frequency != null) updates.frequency = parsed.data.frequency;
  if (parsed.data.dayOfMonth !== undefined) updates.dayOfMonth = parsed.data.dayOfMonth ?? null;
  if (parsed.data.participants != null) updates.participants = parsed.data.participants;
  if (parsed.data.splitType != null) updates.splitType = parsed.data.splitType;
  if (parsed.data.payerName != null) updates.payerName = parsed.data.payerName;
  if (parsed.data.isActive != null) updates.isActive = parsed.data.isActive;

  const [recurring] = await db.update(recurringBillsTable).set(updates).where(eq(recurringBillsTable.id, params.data.id)).returning();
  if (!recurring) {
    res.status(404).json({ error: "Recurring bill not found" });
    return;
  }
  res.json(serializeRecurring(recurring));
});

router.delete("/recurring/:id", async (req, res): Promise<void> => {
  const params = DeleteRecurringParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [recurring] = await db.delete(recurringBillsTable).where(eq(recurringBillsTable.id, params.data.id)).returning();
  if (!recurring) {
    res.status(404).json({ error: "Recurring bill not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/recurring/:id/fire", async (req, res): Promise<void> => {
  const params = FireRecurringParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [recurring] = await db.select().from(recurringBillsTable).where(eq(recurringBillsTable.id, params.data.id));
  if (!recurring) {
    res.status(404).json({ error: "Recurring bill not found" });
    return;
  }

  const [event] = await db.insert(eventsTable).values({
    title: recurring.name,
    description: recurring.description,
    totalAmount: recurring.amount,
    splitType: "equal",
    payerName: recurring.payerName,
    recurringId: recurring.id,
  }).returning();

  // Parse participants from JSON and add them
  try {
    const participants = JSON.parse(recurring.participants) as Array<{ name: string; phone: string }>;
    const shareAmount = parseFloat(String(recurring.amount)) / participants.length;
    for (const p of participants) {
      await db.insert(participantsTable).values({
        eventId: event.id,
        name: p.name,
        mpesaPhone: p.phone,
        shareAmount: String(shareAmount),
      });
    }
  } catch (_err) {
    // Invalid participants JSON, skip
  }

  await db.update(recurringBillsTable).set({
    lastFiredAt: new Date(),
    nextFireAt: computeNextFireAt(recurring.frequency, recurring.dayOfMonth),
  }).where(eq(recurringBillsTable.id, recurring.id));

  await db.insert(activityLogTable).values({
    type: "event_created",
    eventId: event.id,
    eventTitle: event.title,
  });

  res.status(201).json({ ...event, totalAmount: parseFloat(String(event.totalAmount)), participantCount: 0, paidCount: 0, outstandingAmount: 0 });
});

export default router;
