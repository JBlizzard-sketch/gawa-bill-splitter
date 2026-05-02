import { Router, type IRouter } from "express";
import { eq, sql, isNull, or } from "drizzle-orm";
import { db, eventsTable, participantsTable, billItemsTable, paymentsTable, activityLogTable } from "@workspace/db";
import {
  ListEventsQueryParams,
  CreateEventBody,
  GetEventParams,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function buildEventWithCounts(event: typeof eventsTable.$inferSelect, participants: typeof participantsTable.$inferSelect[]) {
  const paidCount = participants.filter(p => p.paymentStatus === "paid").length;
  const outstandingAmount = participants
    .filter(p => p.paymentStatus !== "paid")
    .reduce((sum, p) => sum + parseFloat(String(p.shareAmount)), 0);
  return {
    ...event,
    totalAmount: parseFloat(String(event.totalAmount)),
    participantCount: participants.length,
    paidCount,
    outstandingAmount,
  };
}

router.get("/events", async (req, res): Promise<void> => {
  const query = ListEventsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const events = query.data.tripId != null
    ? await db.select().from(eventsTable).where(eq(eventsTable.tripId, query.data.tripId)).orderBy(eventsTable.createdAt)
    : await db.select().from(eventsTable).orderBy(sql`${eventsTable.createdAt} DESC`);

  const results = await Promise.all(
    events.map(async (event) => {
      const participants = await db.select().from(participantsTable).where(eq(participantsTable.eventId, event.id));
      return buildEventWithCounts(event, participants);
    })
  );

  res.json(results);
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [event] = await db.insert(eventsTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    totalAmount: String(parsed.data.totalAmount),
    splitType: parsed.data.splitType,
    payerName: parsed.data.payerName,
    tripId: parsed.data.tripId ?? null,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "event_created",
    eventId: event.id,
    eventTitle: event.title,
    amount: event.totalAmount,
  });

  res.status(201).json({ ...event, totalAmount: parseFloat(String(event.totalAmount)), participantCount: 0, paidCount: 0, outstandingAmount: 0 });
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [participants, items, payments] = await Promise.all([
    db.select().from(participantsTable).where(eq(participantsTable.eventId, event.id)),
    db.select().from(billItemsTable).where(eq(billItemsTable.eventId, event.id)),
    db.select().from(paymentsTable).where(eq(paymentsTable.eventId, event.id)).orderBy(sql`${paymentsTable.createdAt} DESC`),
  ]);

  const paidCount = participants.filter(p => p.paymentStatus === "paid").length;
  const outstandingAmount = participants
    .filter(p => p.paymentStatus !== "paid")
    .reduce((sum, p) => sum + parseFloat(String(p.shareAmount)), 0);

  res.json({
    ...event,
    totalAmount: parseFloat(String(event.totalAmount)),
    participants: participants.map(p => ({ ...p, shareAmount: parseFloat(String(p.shareAmount)) })),
    items: items.map(i => ({ ...i, amount: parseFloat(String(i.amount)) })),
    payments: payments.map(p => ({ ...p, amount: parseFloat(String(p.amount)) })),
    participantCount: participants.length,
    paidCount,
    outstandingAmount,
  });
});

router.patch("/events/:id", async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof eventsTable.$inferInsert> = {};
  if (parsed.data.title != null) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
  if (parsed.data.totalAmount != null) updates.totalAmount = String(parsed.data.totalAmount);
  if (parsed.data.splitType != null) updates.splitType = parsed.data.splitType;
  if (parsed.data.status != null) updates.status = parsed.data.status;
  if (parsed.data.payerName != null) updates.payerName = parsed.data.payerName;

  const [event] = await db.update(eventsTable).set(updates).where(eq(eventsTable.id, params.data.id)).returning();
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  if (event.status === "settled") {
    await db.insert(activityLogTable).values({
      type: "event_settled",
      eventId: event.id,
      eventTitle: event.title,
    });
  }

  const participants = await db.select().from(participantsTable).where(eq(participantsTable.eventId, event.id));
  res.json(buildEventWithCounts(event, participants));
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(participantsTable).where(eq(participantsTable.eventId, params.data.id));
  await db.delete(billItemsTable).where(eq(billItemsTable.eventId, params.data.id));
  await db.delete(paymentsTable).where(eq(paymentsTable.eventId, params.data.id));
  const [event] = await db.delete(eventsTable).where(eq(eventsTable.id, params.data.id)).returning();

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
