import { logger } from "./logger";

interface MpesaTokenResponse {
  access_token: string;
  expires_in: string;
}

interface StkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

interface StkPushResult {
  success: boolean;
  checkoutRequestId: string | null;
  errorMessage: string | null;
}

function getConfig() {
  return {
    consumerKey: process.env.MPESA_CONSUMER_KEY ?? "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "",
    shortcode: process.env.MPESA_SHORTCODE ?? "174379",
    passkey: process.env.MPESA_PASSKEY ?? "",
    callbackUrl: process.env.MPESA_CALLBACK_URL ?? "",
    environment: process.env.MPESA_ENVIRONMENT ?? "sandbox",
  };
}

function getBaseUrl(environment: string) {
  return environment === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

async function getAccessToken(): Promise<string> {
  const config = getConfig();
  const baseUrl = getBaseUrl(config.environment);
  const credentials = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`
  ).toString("base64");

  const response = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get Mpesa token: ${response.statusText}`);
  }

  const data = (await response.json()) as MpesaTokenResponse;
  return data.access_token;
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    return "254" + cleaned.slice(1);
  }
  if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
    return "254" + cleaned;
  }
  return cleaned;
}

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

export async function sendStkPush(
  phone: string,
  amount: number,
  accountReference: string,
  description: string
): Promise<StkPushResult> {
  const config = getConfig();

  if (!config.consumerKey || !config.consumerSecret || !config.passkey) {
    logger.warn(
      "Mpesa credentials not configured — returning simulated sandbox response"
    );
    return {
      success: true,
      checkoutRequestId: `ws_CO_${Date.now()}_SANDBOX`,
      errorMessage: null,
    };
  }

  try {
    const baseUrl = getBaseUrl(config.environment);
    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = Buffer.from(
      `${config.shortcode}${config.passkey}${timestamp}`
    ).toString("base64");

    const formattedPhone = formatPhone(phone);
    const roundedAmount = Math.ceil(amount);

    const payload = {
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: roundedAmount,
      PartyA: formattedPhone,
      PartyB: config.shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: config.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: description,
    };

    const response = await fetch(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = (await response.json()) as StkPushResponse;

    if (data.ResponseCode === "0") {
      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        errorMessage: null,
      };
    } else {
      return {
        success: false,
        checkoutRequestId: null,
        errorMessage: data.ResponseDescription ?? "STK push failed",
      };
    }
  } catch (err) {
    logger.error({ err }, "Mpesa STK push error");
    return {
      success: false,
      checkoutRequestId: null,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
