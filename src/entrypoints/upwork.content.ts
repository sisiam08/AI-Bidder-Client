import { defineContentScript } from "wxt/sandbox";
import { upworkAdapter } from "../platforms/upwork/index";
import {
  detectSettingsStorage,
  pendingFillStorage,
  sessionTokenStorage,
} from "../lib/storage";
import { submitDetectedJob } from "../lib/submit-job";
import { showToast } from "../lib/toast";
import { mountToastHost } from "../lib/toast-host";
import { notifyBidBlocked } from "../lib/bid-blocked";
import type { ApprovedProposal, FillResult } from "../lib/types";
import { browser } from "wxt/browser";
import type { ContentScriptContext } from "wxt/client";

function handleFillResult(
  result: FillResult | null | undefined,
  data: ApprovedProposal,
) {
  if (!result) return;
  if (result.blocked) {
    const reasons = result.blockedReasons ?? ["unspecified"];
    const reasonText = reasons.join("; ");
    showToast(`Bid blocked: ${reasonText}`, "error");
    if (data.jobId) {
      void notifyBidBlocked({ jobId: data.jobId, reasons });
    }
    return;
  }
  if (result.success && data.jobId) {
    void browser.runtime
      .sendMessage({ type: "MARK_PROPOSAL_FILLED", jobId: data.jobId })
      .catch(() => {});
  }
}

async function detectJobs() {
  const token = await sessionTokenStorage.getValue();
  if (!token) {
    console.warn(
      "[upwork] Cannot detect jobs: no session. Fill the popup form first.",
    );
    return;
  }
  if (!upworkAdapter.detect()) {
    console.log("[upwork] No job listing detected on this page.");
    return;
  }
  const jobs = upworkAdapter.extractJobs();
  console.log("[upwork] detected jobs:", jobs);
  let duplicates = 0;
  let errors = 0;
  for (const job of jobs) {
    const result = await submitDetectedJob(job);
    if (result.status === "duplicate") {
      duplicates += 1;
    } else if (result.status === "error") {
      errors += 1;
    }
  }
  if (duplicates > 0) {
    showToast(
      `${duplicates} duplicate job${duplicates > 1 ? "s" : ""} detected`,
      "info",
    );
  }
  if (errors > 0) {
    showToast(
      `Failed to send ${errors} new job${errors > 1 ? "s" : ""} to server`,
      "error",
    );
  }
}

export default defineContentScript({
  matches: ["*://*.upwork.com/*"],
  runAt: "document_idle",
  main(ctx: ContentScriptContext) {
    mountToastHost(ctx);
    const w = window as unknown as Record<string, unknown>;
    if (w.__agenticUpworkReady) return;
    w.__agenticUpworkReady = true;

    const attemptPendingFill = () => {
      pendingFillStorage.getValue().then((pending) => {
        if (!pending || pending.platform !== "upwork" || !pending.externalJobId)
          return;
        const targetId =
          pending.externalJobId.match(/~([a-f0-9]+)/)?.[1] ??
          pending.externalJobId;
        const currentId = location.pathname.match(/~([a-f0-9]+)/)?.[1] ?? "";
        if (
          location.pathname === pending.externalJobId ||
          location.pathname.startsWith(pending.externalJobId) ||
          (targetId && currentId === targetId)
        ) {
          Promise.resolve(upworkAdapter.fillProposal(pending)).then((result) => {
            handleFillResult(result, pending);
            if (result.success || result.blocked) {
              pendingFillStorage.setValue(null);
              return;
            }
            scheduleFillRetry();
          });
        } else {
          scheduleFillRetry();
        }
      });
    };

    let fillRetryTimer: number | undefined;
    const scheduleFillRetry = () => {
      if (fillRetryTimer) return;
      fillRetryTimer = window.setTimeout(() => {
        fillRetryTimer = undefined;
        attemptPendingFill();
      }, 2000);
    };

    attemptPendingFill();

    browser.runtime.onMessage.addListener(
      (msg: unknown, _sender, sendResponse: (response: unknown) => void) => {
        const m = msg as { type?: string; data?: ApprovedProposal };
        if (m.type === "FILL_PROPOSAL" && m.data) {
          const data = m.data;
          Promise.resolve(upworkAdapter.fillProposal(data)).then((result) => {
            handleFillResult(result, data);
            sendResponse(result);
          });
          return true;
        }
        if (m.type === "DETECT_JOBS") {
          void detectJobs();
        } else if (m.type === "NO_SESSION") {
          console.warn(
            "[upwork] Cannot detect jobs: no session. Fill the popup form first.",
          );
        }
        sendResponse({ ok: true });
        return true;
      },
    );

    void detectSettingsStorage.getValue().then((settings) => {
      if (settings.mode === "auto") {
        void detectJobs();
      }
    });
  },
});
