import AutofillPageDetails from "@bitwarden/browser/autofill/models/autofill-page-details";
import {
  generateLoginFillScript,
  type LoginFillOptions,
} from "@bitwarden/browser/autofill/utils/login-fill-script";

import type { CredentialSource } from "./credential-source";
import {
  CollectCommand,
  FillCommand,
  type CollectResponse,
  type FillMessage,
  type FillResponse,
  type FillResult,
} from "./messages";
import { approvedOrigin, formActionLeavesOrigin } from "./origin-policy";

const TOP_FRAME = 0;

const fillOptions: LoginFillOptions = {
  skipUsernameOnlyFill: false,
  onlyEmptyFields: false,
  fillNewPassword: false,
  allowTotpAutofill: false,
  autoSubmitLogin: false,
};

async function topFrameUrl(tabId: number): Promise<string | undefined> {
  const tab = await chrome.tabs.get(tabId);
  return tab.url;
}

async function ensureContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [TOP_FRAME] },
    files: ["content.js"],
    world: "ISOLATED",
  });
}

function filledFormActions(
  fillScript: FillMessage["fillScript"],
  pageDetails: AutofillPageDetails,
): (string | undefined)[] {
  const filledOpids = new Set(
    fillScript.script.filter(([action]) => action === "fill_by_opid").map(([, opid]) => opid),
  );
  const actions: (string | undefined)[] = [];
  for (const field of pageDetails.fields) {
    if (filledOpids.has(field.opid) && field.form != null) {
      actions.push(pageDetails.forms?.[field.form]?.htmlAction);
    }
  }
  return actions;
}

/**
 * Fills the login in the top frame of a tab. The origin and URL come from the browser's record
 * of the tab, never from the caller. The result carries a status only.
 */
export async function fillLoginInTab(tabId: number, source: CredentialSource): Promise<FillResult> {
  try {
    const url = await topFrameUrl(tabId);
    const origin = approvedOrigin(url, __ALLOW_LOCALHOST__);
    if (url == null || origin == null) {
      return { status: "refused_origin" };
    }

    await ensureContentScript(tabId);

    const collected = (await chrome.tabs.sendMessage(
      tabId,
      { command: CollectCommand, expectedUrl: url },
      { frameId: TOP_FRAME },
    )) as CollectResponse | undefined;
    if (!collected?.ok) {
      return { status: "page_changed" };
    }

    // The credential is requested only after the page looks fillable, so the user is not
    // prompted for a page with nothing to fill.
    const probe = generateLoginFillScript(
      collected.pageDetails,
      { username: "x", password: "x" },
      fillOptions,
    );
    if (!probe.script.some(([action]) => action === "fill_by_opid")) {
      return { status: "no_fields" };
    }

    const credential = await source.request(origin);
    if (credential == null) {
      return { status: "no_credential" };
    }

    const fillScript = generateLoginFillScript(collected.pageDetails, credential, fillOptions);

    if (
      filledFormActions(fillScript, collected.pageDetails).some((action) =>
        formActionLeavesOrigin(action, url),
      )
    ) {
      return { status: "refused_form_action" };
    }

    if ((await topFrameUrl(tabId)) !== url) {
      return { status: "page_changed" };
    }

    const response = (await chrome.tabs.sendMessage(
      tabId,
      { command: FillCommand, expectedUrl: url, fillScript } satisfies FillMessage,
      { frameId: TOP_FRAME },
    )) as FillResponse | undefined;

    return response?.ok
      ? {
          status: "ok",
          filledFields: fillScript.script.filter(([action]) => action === "fill_by_opid").length,
        }
      : { status: "page_changed" };
  } catch {
    return { status: "error" };
  }
}
