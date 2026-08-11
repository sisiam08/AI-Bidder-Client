import { browser } from "wxt/browser";

export interface BidBlockedPayload {
  jobId?: string;
  reasons: string[];
}

export type BidBlockedResult =
  | { status: "sent" }
  | { status: "error" };

export async function notifyBidBlocked(
  payload: BidBlockedPayload,
): Promise<BidBlockedResult> {
  try {
    const result = (await browser.runtime.sendMessage({
      type: "NOTIFY_BID_BLOCKED",
      ...payload,
    })) as BidBlockedResult;
    return result ?? { status: "error" };
  } catch (err) {
    console.error("[bid-blocked] NOTIFY_BID_BLOCKED error:", err);
    return { status: "error" };
  }
}
