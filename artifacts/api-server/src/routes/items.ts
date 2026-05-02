import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, billItemsTable } from "@workspace/db";
import {
  ListItemsParams,
  CreateItemParams,
  CreateItemBody,
  UpdateItemParams,
  UpdateItemBody,
  DeleteItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeItem(i: typeof billItemsTable.$inferSelect) {
  return { ...i, amount: parseFloat(String(i.amount)) };
}

router.get("/events/:eventId/items", async (req, res): Promise<void> => {
  const params = ListItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const items = await db.select().from(billItemsTable).where(eq(billItemsTable.eventId, params.data.eventId));
  res.json(items.map(serializeItem));
});

router.post("/events/:eventId/items", async (req, res): Promise<void> => {
  const params = CreateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.insert(billItemsTable).values({
    eventId: params.data.eventId,
    name: parsed.data.name,
    amount: String(parsed.data.amount),
    assignedTo: parsed.data.assignedTo ?? null,
  }).returning();
  res.status(201).json(serializeItem(item));
});

router.patch("/events/:eventId/items/:itemId", async (req, res): Promise<void> => {
  const params = UpdateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Partial<typeof billItemsTable.$inferInsert> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.amount != null) updates.amount = String(parsed.data.amount);
  if (parsed.data.assignedTo !== undefined) updates.assignedTo = parsed.data.assignedTo ?? null;

  const [item] = await db
    .update(billItemsTable)
    .set(updates)
    .where(and(eq(billItemsTable.id, params.data.itemId), eq(billItemsTable.eventId, params.data.eventId)))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.json(serializeItem(item));
});

router.delete("/events/:eventId/items/:itemId", async (req, res): Promise<void> => {
  const params = DeleteItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db
    .delete(billItemsTable)
    .where(and(eq(billItemsTable.id, params.data.itemId), eq(billItemsTable.eventId, params.data.eventId)))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
