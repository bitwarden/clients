import { TransitionValidity, validateTransition } from "../../../lifecycle/transition-buffer";
import { TargetSource } from "../../enums";
import type { FillResult } from "../../types";
import { AUTOFILL_DENIED } from "../../utils";
import type { FillRequest, FillTarget, ReportedDocument, Targeted } from "../context";
import { FillRequestKind } from "../enums";
import type { FillServices } from "../services";
import type { FillPhase, TargetPlan } from "../types";

import { invalid, REQUEST_MISMATCH } from "./results";

/** The frame id of a tab's top frame, as the browser addresses it. */
const TOP_FRAME = 0;

const UNNAMED_TOP_DOCUMENT = "the browser did not report which document the tab holds";
const UNNAMED_FRAME_DOCUMENT = "the browser did not report which document the frame holds";

/** The services the target phases and {@link verifyTarget} work with. */
export type TargetServices = Pick<FillServices, "browser" | "logService" | "now">;

/** The target phase a plan's target sub-plan calls for. */
export function targetPhase(
  plan: TargetPlan,
  services: TargetServices,
): FillPhase<FillRequest, Targeted> {
  switch (plan.source) {
    case TargetSource.User:
    case TargetSource.Policy:
      return targetFromRequest(services);
    case TargetSource.Reported:
      return reportedTarget(services);
  }
}

/**
 * The target of a fill that carries its tab.
 *
 * When this phase executes, it records the target: the tab, the frame the fill reads and fills, the
 * tab's URL, and the document the tab's top frame held when the fill was requested.
 *
 * Checks:
 *  * The request carries a tab.
 *  * The tab has an id.
 *  * The tab's top frame existed when the fill was requested. A document the browser does not name
 *    makes the fill invalid (see `model.md`, "The target").
 */
export function targetFromRequest({
  logService,
}: Pick<TargetServices, "logService">): FillPhase<FillRequest, Targeted> {
  return {
    check: async (request) => {
      if (request.kind === FillRequestKind.Reported) {
        return invalid(logService, REQUEST_MISMATCH);
      }
      if (request.tab.id == null) {
        return AUTOFILL_DENIED;
      }
      const frame = await request.topFrame;
      if (frame == null) {
        return AUTOFILL_DENIED;
      }
      if (frame.documentId == null) {
        return invalid(logService, UNNAMED_TOP_DOCUMENT);
      }
      return undefined;
    },
    execute: async (request) => {
      // The check verified these; this narrows them.
      if (request.kind === FillRequestKind.Reported) {
        return invalid(logService, REQUEST_MISMATCH);
      }
      const { tab, frameId } = request;
      const frame = await request.topFrame;
      if (tab.id == null || frame?.documentId == null) {
        return AUTOFILL_DENIED;
      }
      return {
        target: { tabId: tab.id, tab, frameId, url: tab.url, documentId: frame.documentId },
      };
    },
  };
}

/**
 * The target of a fill that a transition report requested.
 *
 * When this phase executes, it records the target: the tab, the reporting frame, the report's URL,
 * and the document the tab's top frame holds as the target resolves. A tab or top frame that is gone
 * denies the fill, and a top-frame document the browser does not name makes it invalid.
 *
 * Checks:
 *  * The request carries a report.
 *  * The reporting frame holds the reported document, within the report's deadline (see `model.md`,
 *    "The target").
 */
export function reportedTarget(services: TargetServices): FillPhase<FillRequest, Targeted> {
  const { browser, logService } = services;
  return {
    check: async (request) =>
      request.kind === FillRequestKind.Reported
        ? checkReport(request.report, services)
        : invalid(logService, REQUEST_MISMATCH),
    execute: async (request) => {
      // The check verified this; this narrows it.
      if (request.kind !== FillRequestKind.Reported) {
        return invalid(logService, REQUEST_MISMATCH);
      }
      const { report } = request;
      const tab = await browser.tab(report.tabId);
      const top = await browser.frame(report.tabId, TOP_FRAME);
      if (tab == null || top == null) {
        return AUTOFILL_DENIED;
      }
      if (top.documentId == null) {
        return invalid(logService, UNNAMED_TOP_DOCUMENT);
      }
      return {
        target: {
          tabId: report.tabId,
          tab,
          frameId: report.frameId ?? TOP_FRAME,
          url: report.url,
          documentId: top.documentId,
          report: {
            frameId: report.frameId,
            documentId: report.documentId,
            expiresAt: report.expiresAt,
          },
        },
      };
    },
  };
}

/**
 * Verifies that the browser still holds a fill's target (see `model.md`, "The target"). Resolves to
 * `undefined` when it does. Otherwise resolves to the result that ends the fill: denied when the
 * tab, a frame, or a document is gone or changed, or the report expired; invalid when the browser
 * does not name a document.
 */
export async function verifyTarget(
  target: FillTarget,
  services: TargetServices,
): Promise<FillResult | undefined> {
  const { browser, logService } = services;
  const tab = await browser.tab(target.tabId);
  const top = await browser.frame(target.tabId, TOP_FRAME);
  if (tab == null || top == null) {
    return AUTOFILL_DENIED;
  }
  if (top.documentId == null) {
    return invalid(logService, UNNAMED_TOP_DOCUMENT);
  }
  if (top.documentId !== target.documentId) {
    return AUTOFILL_DENIED;
  }
  if (target.report) {
    return checkReport({ tabId: target.tabId, ...target.report }, services);
  }
  return undefined;
}

/** Verifies that a reporting frame still holds the reported document, within the deadline. */
async function checkReport(
  report: ReportedDocument & Readonly<{ tabId: number }>,
  { browser, logService, now }: TargetServices,
): Promise<FillResult | undefined> {
  const frame = await browser.frame(report.tabId, report.frameId ?? TOP_FRAME);
  switch (validateTransition(report, frame, now())) {
    case TransitionValidity.Valid:
      return undefined;
    case TransitionValidity.Unverifiable:
      return invalid(logService, UNNAMED_FRAME_DOCUMENT);
    default:
      return AUTOFILL_DENIED;
  }
}
