import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, participantsTable, eventsTable, activityLogTable } from "@workspace/db";
import {
  ListParticipantsParams,
  AddParticipantParams,
  AddParticipantBody,
  UpdateParticipantParams,
  UpdateParticipantBody,
  RemoveParticipantParams,
  MarkPaidParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeParticipant(p: typeof participantsTable.$inferSelect) {
  return { ...p, shareAmount: parseFloat(String(p.shareAmount)) };
}

router.get("/events/:eventId/participants", async (req, res): Promise<void> => {
  const params = ListParticipantsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const participants = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.eventId, params.data.eventId));
  res.json(participants.map(serializeParticipant));
});

router.post("/events/:eventId/participants", async (req, res): Promise<void> => {
  const params = AddParticipantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddParticipantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Auto-calculate equal share if not provided
  let shareAmount = parsed.data.shareAmount ?? 0;
  if (!parsed.data.shareAmount) {
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.eventId));
    if (event) {
      const existingParticipants = await db.select().from(participantsTable).where(eq(participantsTable.eventId, params.data.eventId));
      const total = parseFloat(String(event.totalAmount));
      shareAmount = total / (existingParticipants.length + 1);
    }
  }

  const [participant] = await db.insert(participantsTable).values({
    eventId: params.data.eventId,
    name: parsed.data.name,
    mpesaPhone: parsed.data.mpesaPhone,
    shareAmount: String(shareAmount),
    paymentStatus: "pending",
  }).returning();

  res.status(201).json(serializeParticipant(participant));
});

router.patch("/events/:eventId/participants/:participantId", async (req, res): Promise<void> => {
  const params = UpdateParticipantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateParticipantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof participantsTable.$inferInsert> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.mpesaPhone != null) updates.mpesaPhone = parsed.data.mpesaPhone;
  if (parsed.data.shareAmount != null) updates.shareAmount = String(parsed.data.shareAmount);

  const [participant] = await db
    .update(participantsTable)
    .set(updates)
    .where(and(
      eq(participantsTable.id, params.data.participantId),
      eq(participantsTable.eventId, params.data.eventId)
    ))
    .returning();

  if (!participant) {
    res.status(404).json({ error: "Participant not found" });
    return;
  }

  res.json(serializeParticipant(participant));
});

router.delete("/events/:eventId/participants/:participantId", async (req, res): Promise<void> => {
  const params = RemoveParticipantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [participant] = await db
    .delete(participantsTable)
    .where(and(
      eq(participantsTable.id, params.data.participantId),
      eq(participantsTable.eventId, params.data.eventId)
    ))
    .returning();

  if (!participant) {
    res.status(404).json({ error: "Participant not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/events/:eventId/participants/:participantId/mark-paid", async (req, res): Promise<void> => {
  const params = MarkPaidParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [participant] = await db
    .update(participantsTable)
    .set({ paymentStatus: "paid", paidAt: new Date() })
    .where(and(
      eq(participantsTable.id, params.data.participantId),
      eq(participantsTable.eventId, params.data.eventId)
    ))
    .returning();

  if (!participant) {
    res.status(404).json({ error: "Participant not found" });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.eventId));
  if (event) {
    await db.insert(activityLogTable).values({
      type: "payment_received",
      eventId: event.id,
      eventTitle: event.title,
      participantName: participant.name,
      amount: participant.shareAmount,
    });
  }

  res.json(serializeParticipant(participant));
});

export default router;
