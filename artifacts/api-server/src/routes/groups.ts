import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, groupsTable, groupMembersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/groups", async (_req, res): Promise<void> => {
  const groups = await db.select().from(groupsTable).orderBy(groupsTable.name);
  const members = await db.select().from(groupMembersTable);
  const result = groups.map(g => ({
    ...g,
    memberCount: members.filter(m => m.groupId === g.id).length,
  }));
  res.json(result);
});

router.post("/groups", async (req, res): Promise<void> => {
  const { name } = req.body as { name?: string };
  if (!name || name.trim().length < 2) {
    res.status(400).json({ error: "Group name must be at least 2 characters" });
    return;
  }
  const [group] = await db.insert(groupsTable).values({ name: name.trim() }).returning();
  res.status(201).json({ ...group, memberCount: 0, members: [] });
});

router.get("/groups/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid group id" }); return; }
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, id));
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }
  const members = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, id));
  res.json({ ...group, memberCount: members.length, members });
});

router.delete("/groups/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid group id" }); return; }
  const [deleted] = await db.delete(groupsTable).where(eq(groupsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Group not found" }); return; }
  res.sendStatus(204);
});

router.post("/groups/:id/members", async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId) || groupId <= 0) { res.status(400).json({ error: "Invalid group id" }); return; }
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }
  const { name, mpesaPhone } = req.body as { name?: string; mpesaPhone?: string };
  if (!name || name.trim().length < 2) { res.status(400).json({ error: "Name is required" }); return; }
  if (!mpesaPhone || mpesaPhone.trim().length < 9) { res.status(400).json({ error: "Valid phone number is required" }); return; }
  const [member] = await db.insert(groupMembersTable).values({ groupId, name: name.trim(), mpesaPhone: mpesaPhone.trim() }).returning();
  res.status(201).json(member);
});

router.delete("/groups/:id/members/:memberId", async (req, res): Promise<void> => {
  const groupId = parseInt(req.params.id, 10);
  const memberId = parseInt(req.params.memberId, 10);
  if (isNaN(groupId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(groupMembersTable).where(eq(groupMembersTable.id, memberId)).returning();
  if (!deleted) { res.status(404).json({ error: "Member not found" }); return; }
  res.sendStatus(204);
});

export default router;
