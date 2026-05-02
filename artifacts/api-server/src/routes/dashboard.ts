import { Router, type IRouter } from "express";
import { sql, desc, and, gte, eq } from "drizzle-orm";
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

router.get("/dashboard/weekly", async (_req, res): Promise<void> => {
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Build last-7-days date range in UTC
  const days: { date: string; day: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    days.push({
      date: d.toISOString().slice(0, 10),
      day: DAY_LABELS[d.getUTCDay()],
    });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  // Collected: participants with paidAt in range
  const paidRows = await db
    .select({
      date: sql<string>`to_char(${participantsTable.paidAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      total: sql<string>`SUM(${participantsTable.shareAmount})`,
    })
    .from(participantsTable)
    .where(
      and(
        eq(participantsTable.paymentStatus, "paid"),
        gte(participantsTable.paidAt, sevenDaysAgo)
      )
    )
    .groupBy(sql`to_char(${participantsTable.paidAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

  // Pending: participants with pending/requested status, created in range
  const pendingRows = await db
    .select({
      date: sql<string>`to_char(${participantsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
      total: sql<string>`SUM(${participantsTable.shareAmount})`,
    })
    .from(participantsTable)
    .where(
      and(
        sql`${participantsTable.paymentStatus} IN ('pending', 'requested')`,
        gte(participantsTable.createdAt, sevenDaysAgo)
      )
    )
    .groupBy(sql`to_char(${participantsTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`);

  const collectedByDay = Object.fromEntries(paidRows.map(r => [r.date, parseFloat(r.total ?? "0")]));
  const pendingByDay   = Object.fromEntries(pendingRows.map(r => [r.date, parseFloat(r.total ?? "0")]));

  const result = days.map(({ date, day }) => ({
    day,
    date,
    collected: collectedByDay[date] ?? 0,
    pending:   pendingByDay[date]   ?? 0,
  }));

  res.json(result);
});

export default router;
