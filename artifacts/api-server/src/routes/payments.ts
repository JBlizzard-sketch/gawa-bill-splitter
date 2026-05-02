import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, participantsTable, paymentsTable, eventsTable, activityLogTable } from "@workspace/db";
import {
  SendPaymentRequestsParams,
  ListPaymentsParams,
} from "@workspace/api-zod";
import { sendStkPush } from "../lib/mpesa";
import { sendSms, buildPaymentRequestSms } from "../lib/sms";

const router: IRouter = Router();

router.post("/events/:eventId/send-requests", async (req, res): Promise<void> => {
  const params = SendPaymentRequestsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.eventId));
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const unpaidParticipants = await db
    .select()
    .from(participantsTable)
    .where(eq(participantsTable.eventId, params.data.eventId));

  const pending = unpaidParticipants.filter(
    p => p.paymentStatus === "pending" || p.paymentStatus === "failed"
  );

  const results = await Promise.all(
    pending.map(async (participant) => {
      const amount = parseFloat(String(participant.shareAmount));
      const result = await sendStkPush(
        participant.mpesaPhone,
        amount,
        `GAWA-${event.id}`,
        `Split bill: ${event.title}`
      );

      if (result.success) {
        await db
          .update(participantsTable)
          .set({ paymentStatus: "requested" })
          .where(eq(participantsTable.id, participant.id));

        await db.insert(paymentsTable).values({
          eventId: event.id,
          participantId: participant.id,
          participantName: participant.name,
          amount: String(amount),
          mpesaPhone: participant.mpesaPhone,
          status: "initiated",
          checkoutRequestId: result.checkoutRequestId,
        });

        await db.insert(activityLogTable).values({
          type: "payment_requested",
          eventId: event.id,
          eventTitle: event.title,
          participantName: participant.name,
          amount: participant.shareAmount,
        });

        // Send SMS reminder alongside the Mpesa STK push
        const domain = (process.env.REPLIT_DOMAINS ?? "").split(",")[0]?.trim() ?? "";
        const shareUrl = domain ? `https://${domain}/share/${event.id}` : `/share/${event.id}`;
        const smsBody = buildPaymentRequestSms({
          participantName: participant.name,
          amount,
          eventTitle: event.title,
          payerName: event.payerName,
          shareUrl,
        });
        // fire-and-forget — don't fail the whole request if SMS fails
        sendSms(participant.mpesaPhone, smsBody).catch(() => {});
      } else {
        await db
          .update(participantsTable)
          .set({ paymentStatus: "failed" })
          .where(eq(participantsTable.id, participant.id));
      }

      return {
        participantId: participant.id,
        participantName: participant.name,
        phone: participant.mpesaPhone,
        success: result.success,
        checkoutRequestId: result.checkoutRequestId,
        errorMessage: result.errorMessage,
      };
    })
  );

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  // Update event status
  if (sent > 0) {
    await db
      .update(eventsTable)
      .set({ status: "sent" })
      .where(eq(eventsTable.id, event.id));
  }

  res.json({ sent, failed, results });
});

router.get("/events/:eventId/payments", async (req, res): Promise<void> => {
  const params = ListPaymentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.eventId, params.data.eventId));

  res.json(payments.map(p => ({ ...p, amount: parseFloat(String(p.amount)) })));
});

router.post("/mpesa/callback", async (req, res): Promise<void> => {
  const body = req.body as {
    Body?: {
      stkCallback?: {
        MerchantRequestID?: string;
        CheckoutRequestID?: string;
        ResultCode?: number;
        ResultDesc?: string;
        CallbackMetadata?: {
          Item?: Array<{ Name: string; Value?: string | number }>;
        };
      };
    };
  };

  const callback = body?.Body?.stkCallback;
  if (!callback) {
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    return;
  }

  const checkoutRequestId = callback.CheckoutRequestID;
  const resultCode = callback.ResultCode;

  if (!checkoutRequestId) {
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    return;
  }

  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.checkoutRequestId, checkoutRequestId));

  if (!payment) {
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    return;
  }

  if (resultCode === 0) {
    const meta = callback.CallbackMetadata?.Item ?? [];
    const receiptItem = meta.find(i => i.Name === "MpesaReceiptNumber");
    const receipt = receiptItem?.Value != null ? String(receiptItem.Value) : null;

    await db.update(paymentsTable).set({ status: "success", mpesaReceiptNumber: receipt }).where(eq(paymentsTable.id, payment.id));
    await db.update(participantsTable).set({ paymentStatus: "paid", paidAt: new Date(), mpesaReceiptNumber: receipt }).where(eq(participantsTable.id, payment.participantId));

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, payment.eventId));
    if (event) {
      const allParticipants = await db.select().from(participantsTable).where(eq(participantsTable.eventId, payment.eventId));
      const allPaid = allParticipants.every(p => p.paymentStatus === "paid" || p.id === payment.participantId);

      await db.update(eventsTable).set({ status: allPaid ? "settled" : "partial" }).where(eq(eventsTable.id, event.id));

      await db.insert(activityLogTable).values({
        type: "payment_received",
        eventId: event.id,
        eventTitle: event.title,
        participantName: payment.participantName,
        amount: payment.amount,
      });
    }
  } else {
    await db.update(paymentsTable).set({ status: "failed" }).where(eq(paymentsTable.id, payment.id));
    await db.update(participantsTable).set({ paymentStatus: "failed" }).where(eq(participantsTable.id, payment.participantId));
  }

  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

export default router;
