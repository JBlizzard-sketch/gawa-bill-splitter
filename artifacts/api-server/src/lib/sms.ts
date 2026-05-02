import { logger } from "./logger";

interface SmsResult {
  success: boolean;
  messageId: string | null;
  errorMessage: string | null;
}

function toE164Kenya(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  return `+${digits}`;
}

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const apiKey  = process.env.AT_API_KEY  ?? "";
  const username = process.env.AT_USERNAME ?? "";

  if (!apiKey || !username) {
    logger.info({ phone, message }, "[SMS sandbox] Africa's Talking credentials not set — skipping send");
    return { success: true, messageId: "sandbox", errorMessage: null };
  }

  const e164 = toE164Kenya(phone);
  const isSandbox = username === "sandbox";
  const url = isSandbox
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const body = new URLSearchParams({
    username,
    to: e164,
    message,
  });

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const json = await resp.json() as {
      SMSMessageData?: {
        Recipients?: Array<{ messageId?: string; status?: string; statusCode?: number }>;
      };
    };

    const recipient = json.SMSMessageData?.Recipients?.[0];
    if (recipient?.statusCode === 101) {
      logger.info({ phone: e164, messageId: recipient.messageId }, "SMS sent via Africa's Talking");
      return { success: true, messageId: recipient.messageId ?? null, errorMessage: null };
    }

    const errMsg = recipient?.status ?? "Unknown error from Africa's Talking";
    logger.warn({ phone: e164, status: recipient?.status }, "SMS send failed");
    return { success: false, messageId: null, errorMessage: errMsg };
  } catch (err) {
    logger.error({ err, phone: e164 }, "SMS send threw an error");
    return { success: false, messageId: null, errorMessage: String(err) };
  }
}

export function buildPaymentRequestSms(params: {
  participantName: string;
  amount: number;
  eventTitle: string;
  payerName: string;
  shareUrl: string;
}): string {
  const ksh = new Intl.NumberFormat("en-KE").format(params.amount);
  return (
    `Hi ${params.participantName}! ${params.payerName} has requested Ksh ${ksh} ` +
    `from you for "${params.eventTitle}" via Gawa. ` +
    `Check the M-Pesa prompt on your phone or view the split: ${params.shareUrl}`
  );
}
