import { AUTOFILL_DENIED } from "../../utils";
import type { FillContext } from "../context";
import { FillRequestKind } from "../enums";
import { commitAllowsInactiveTab } from "../plans";
import type { FillServices } from "../services";
import type { CommitPlan, FillCommit } from "../types";

import { verifyAccount } from "./account";
import { verifyTarget } from "./target";

/** The services the commit works with. */
export type CommitServices = Pick<
  FillServices,
  "accountService" | "authService" | "autofillService" | "browser" | "logService" | "now"
>;

/**
 * The commit of a fill.
 *
 * When this phase executes, it fills the page with the selected cipher and the plan's flags,
 * overridden by any the request carries. Whether an untrusted iframe may be filled, and whether the fill
 * submits, are the plan's alone (see `model.md`, invariant 13). It is the point of no return (see
 * `model.md`, invariant 7).
 *
 * Checks:
 *  * The tab holds the target's document, and for a reported target, the reporting frame holds the
 *    reported document within the report's deadline (see `model.md`, "The target").
 *  * The request's account is the active account, and unlocked (see `model.md`, invariant 12).
 *  * The tab is the active tab of the current window, unless the plan allows an inactive one (see
 *    `model.md`, invariant 11).
 */
export function commitPhase(plan: CommitPlan, services: CommitServices): FillCommit<FillContext> {
  const { autofillService, browser } = services;
  const allowsInactiveTab = commitAllowsInactiveTab(plan);
  const { flags } = plan;
  return {
    check: async (context) => {
      const refusal =
        (await verifyTarget(context.target, services)) ??
        (await verifyAccount(context.userId, services));
      if (refusal) {
        return refusal;
      }
      if (allowsInactiveTab) {
        return undefined;
      }
      const active = await browser.activeTab();
      return active?.id === context.target.tabId ? undefined : AUTOFILL_DENIED;
    },
    execute: (context) => {
      const callerFlags =
        context.kind === FillRequestKind.Cipher || context.kind === FillRequestKind.Page
          ? context.flags
          : undefined;
      return autofillService.doAutoFill({
        ...flags,
        ...callerFlags,
        allowUntrustedIframe: flags.allowUntrustedIframe,
        autoSubmitLogin: flags.autoSubmitLogin,
        tab: context.target.tab,
        cipher: context.selection.cipher,
        pageDetails: context.page,
      });
    },
  };
}
