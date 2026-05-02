import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, tripsTable, eventsTable, participantsTable } from "@workspace/db";
import {
  GetTripParams,
  CreateTripBody,
  UpdateTripParams,
  UpdateTripBody,
  DeleteTripParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildTripSummary(trip: typeof tripsTable.$inferSelect) {
  const events = await db.select().from(eventsTable).where(eq(eventsTable.tripId, trip.id));
  let totalSpent = 0;
  let outstandingAmount = 0;
  for (const event of events) {
    totalSpent += parseFloat(String(event.totalAmount));
    const participants = await db.select().from(participantsTable).where(eq(participantsTable.eventId, event.id));
    outstandingAmount += participants
      .filter(p => p.paymentStatus !== "paid")
      .reduce((sum, p) => sum + parseFloat(String(p.shareAmount)), 0);
  }
  return { ...trip, totalSpent, outstandingAmount, eventCount: events.length };
}

router.get("/trips", async (_req, res): Promise<void> => {
  const trips = await db.select().from(tripsTable).orderBy(sql`${tripsTable.createdAt} DESC`);
  const results = await Promise.all(trips.map(buildTripSummary));
  res.json(results);
});

router.post("/trips", async (req, res): Promise<void> => {
  const parsed = CreateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [trip] = await db.insert(tripsTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  }).returning();
  res.status(201).json({ ...trip, totalSpent: 0, outstandingAmount: 0, eventCount: 0 });
});

router.get("/trips/:id", async (req, res): Promise<void> => {
  const params = GetTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, params.data.id));
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const events = await db.select().from(eventsTable).where(eq(eventsTable.tripId, trip.id)).orderBy(sql`${eventsTable.createdAt} DESC`);
  const eventsWithCounts = await Promise.all(events.map(async (event) => {
    const participants = await db.select().from(participantsTable).where(eq(participantsTable.eventId, event.id));
    const paidCount = participants.filter(p => p.paymentStatus === "paid").length;
    const outstandingAmount = participants
      .filter(p => p.paymentStatus !== "paid")
      .reduce((sum, p) => sum + parseFloat(String(p.shareAmount)), 0);
    const participantList = participants.map(p => ({
      id: p.id,
      name: p.name,
      mpesaPhone: p.mpesaPhone,
      shareAmount: parseFloat(String(p.shareAmount)),
      paymentStatus: p.paymentStatus,
    }));
    return { ...event, totalAmount: parseFloat(String(event.totalAmount)), participantCount: participants.length, paidCount, outstandingAmount, participants: participantList };
  }));
  const summary = await buildTripSummary(trip);
  res.json({ ...summary, events: eventsWithCounts });
});

router.patch("/trips/:id", async (req, res): Promise<void> => {
  const params = UpdateTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTripBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Partial<typeof tripsTable.$inferInsert> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;
  if (parsed.data.status != null) updates.status = parsed.data.status;

  const [trip] = await db.update(tripsTable).set(updates).where(eq(tripsTable.id, params.data.id)).returning();
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  const summary = await buildTripSummary(trip);
  res.json(summary);
});

router.delete("/trips/:id", async (req, res): Promise<void> => {
  const params = DeleteTripParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [trip] = await db.delete(tripsTable).where(eq(tripsTable.id, params.data.id)).returning();
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
