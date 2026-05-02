import { Router, type IRouter } from "express";
import { sql, desc } from "drizzle-orm";
import { db, eventsTable, participantsTable, activityLogTable, tripsTable, recurringBillsTable } from "@workspace/db";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const events = await db.select().from(eventsTable);
  const participants = await db.select().from(participantsTable);
  const trips = await db.select().from(tripsTable);
  const recurring = await db.select().from(recurringBillsTable);

  const totalAmountSplit = events.reduce((sum, e) => sum + parseFloat(String(e.totalAmount)), 0);
  const totalCollected = participants
    .filter(p => p.paymentStatus === "paid")
    .reduce((sum, p) => sum + parseFloat(String(p.shareAmount)), 0);
  const totalOutstanding = participants
    .filter(p => p.paymentStatus !== "paid")
    .reduce((sum, p) => sum + parseFloat(String(p.shareAmount)), 0);

  res.json({
    totalEvents: events.length,
    totalAmountSplit,
    totalOutstanding,
    totalCollected,
    activeTrips: trips.filter(t => t.status === "active").length,
    settledEvents: events.filter(e => e.status === "settled").length,
    pendingEvents: events.filter(e => e.status === "draft" || e.status === "sent" || e.status === "partial").length,
    recurringCount: recurring.filter(r => r.isActive).length,
  });
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const query = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = query.success && query.data.limit ? query.data.limit : 10;

  const activity = await db
    .select()
    .from(activityLogTable)
    .orderBy(desc(activityLogTable.createdAt))
    .limit(limit);

  res.json(activity.map(a => ({
    ...a,
    amount: a.amount != null ? parseFloat(String(a.amount)) : null,
  })));
});

export default router;
