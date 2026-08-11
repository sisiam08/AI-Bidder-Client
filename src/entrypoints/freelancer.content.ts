import { defineContentScript } from "wxt/sandbox";
import { freelancerAdapter } from "../platforms/freelancer/index";
import { expandCardDescriptions } from "../platforms/freelancer/extractor";
import { getActiveAdapter } from "../platforms/registry";
import {
  detectSettingsStorage,
  pendingFillStorage,
  sessionTokenStorage,
} from "../lib/storage";
import { submitDetectedJob } from "../lib/submit-job";
import { showToast } from "../lib/toast";
import { mountToastHost } from "../lib/toast-host";
import type { ApprovedProposal, FillResult } from "../lib/types";
import { notifyBidBlocked } from "../lib/bid-blocked";
import { browser } from "wxt/browser";
import type { ContentScriptContext } from "wxt/client";

const cardByJobId = new Map<string, HTMLElement>();

function highlightCard(jobId: string) {
  const card = cardByJobId.get(jobId);
  if (!card) return;
  card.style.transition = "outline 0.3s";
  card.style.outline = "3px solid #2FB6A3";
  window.setTimeout(() => {
    card.style.outline = "";
  }, 6000);
}

let retryAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;

async function detectJobs() {
  const token = await sessionTokenStorage.getValue();
  if (!token) {
    console.warn(
      "[freelancer] Cannot detect jobs: no session. Fill the popup form first.",
    );
    return;
  }
  if (!freelancerAdapter.detect()) {
    console.log("[freelancer] No job listing detected on this page.");
    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
      scheduleRetry();
    }
    return;
  }
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(
      "fl-project-contest-card, .fl-project-contest-card, .JobSearchCard-item",
    ),
  );
  await expandCardDescriptions();
  const jobs = freelancerAdapter.extractJobs();
  console.log("[freelancer] detected jobs:", jobs);
  let duplicates = 0;
  let errors = 0;
  for (let i = 0; i < jobs.length; i++) {
    const card = cards[i];
    const result = await submitDetectedJob(jobs[i]);
    if (result.status === "duplicate") {
      duplicates += 1;
    } else if (result.status === "error") {
      errors += 1;
    } else if (result.status === "created" && card) {
      cardByJobId.set(result.jobId, card);
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
  if (jobs.length > 0) {
    retryAttempts = 0;
  } else {
    scheduleRetry();
  }
}

let retryTimer: number | undefined;
function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined;
    retryAttempts += 1;
    void detectJobs();
  }, 3000);
}

function handleFillResult(
  result: FillResult | null | undefined,
  data: ApprovedProposal,
) {
  if (!result || !result.blocked) return;
  const reasons = result.blockedReasons ?? ["unspecified"];
  const reasonText = reasons.join("; ");
  showToast(`Bid blocked: ${reasonText}`, "error");
  if (data.jobId) {
    void notifyBidBlocked({ jobId: data.jobId, reasons });
  }
}

export default defineContentScript({
  matches: ["*://*.freelancer.com/*", "*://*.freelancer.com.bd/*"],
  runAt: "document_idle",
  main(ctx: ContentScriptContext) {
    mountToastHost(ctx);
    const w = window as unknown as Record<string, unknown>;
    if (w.__agenticFreelancerReady) return;
    w.__agenticFreelancerReady = true;

    pendingFillStorage.getValue().then((pending) => {
      if (
        !pending ||
        pending.platform !== "freelancer" ||
        !pending.externalJobId
      )
        return;
      const idMatch = location.pathname.match(/\/projects\/([^/]+)/);
      if (
        location.pathname === pending.externalJobId ||
        location.pathname.startsWith(pending.externalJobId) ||
        (idMatch && idMatch[1] === pending.externalJobId)
      ) {
        const result = freelancerAdapter.fillProposal(pending);
        handleFillResult(result, pending);
        if (result.success) {
          pendingFillStorage.setValue(null);
        }
      }
    });

    browser.runtime.onMessage.addListener((msg: unknown) => {
      const m = msg as
        | { type: "FILL_PROPOSAL"; data: ApprovedProposal }
        | { type: "WS_EVENT"; event: string; jobId?: string }
        | { type: "DETECT_JOBS" }
        | { type: "NO_SESSION" };
      if (m.type === "FILL_PROPOSAL") {
        const result = getActiveAdapter()?.fillProposal(m.data);
        handleFillResult(result, m.data);
      } else if (m.type === "WS_EVENT") {
        if (m.event === "job.analyzed" || m.event === "job.approved") {
          if (m.jobId) highlightCard(m.jobId);
        }
      } else if (m.type === "DETECT_JOBS") {
        void detectJobs();
      } else if (m.type === "NO_SESSION") {
        console.warn(
          "[freelancer] Cannot detect jobs: no session. Fill the popup form first.",
        );
      }
    });

    void detectSettingsStorage.getValue().then((settings) => {
      if (settings.mode === "auto") {
        void detectJobs();
      }
    });
  },
});
