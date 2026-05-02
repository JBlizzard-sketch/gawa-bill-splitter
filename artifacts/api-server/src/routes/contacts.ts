import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, contactsTable } from "@workspace/db";
import { CreateContactBody } from "@workspace/api-zod";
const router: IRouter = Router();

router.get("/contacts", async (_req, res): Promise<void> => {
  const contacts = await db.select().from(contactsTable).orderBy(contactsTable.name);
  res.json(contacts);
});

router.post("/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(contactsTable)
    .where(eq(contactsTable.mpesaPhone, parsed.data.mpesaPhone));

  if (existing) {
    res.status(409).json({ error: "A contact with this phone number already exists" });
    return;
  }

  const [contact] = await db.insert(contactsTable).values(parsed.data).returning();
  res.status(201).json(contact);
});

router.delete("/contacts/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid contact id" });
    return;
  }

  const [deleted] = await db.delete(contactsTable).where(eq(contactsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
