import {
  generateLoginFillScript,
  type LoginFillOptions,
} from "@bitwarden/browser/autofill/utils/login-fill-script";

import type { CredentialSource } from "./credential-source";
import {
  CollectCommand,
  FillCommand,
  InspectCommand,
  type CollectResponse,
  type FillMessage,
  type FillResponse,
  type FillResult,
  type InspectMessage,
  type InspectResponse,
} from "./messages";
import { approvedOrigin, submitTargetsLeaveOrigin } from "./origin-policy";
import { CredentialRequestError } from "./relay-credential-source";

const TOP_FRAME = 0;
const NOT_FILLED_COOLDOWN_MS = 30_000;

let fillInFlight = false;
const cooldownUntil = new Map<string, number>();

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

function filledOpids(fillScript: FillMessage["fillScript"]): string[] {
  return fillScript.script.filter(([action]) => action === "fill_by_opid").map(([, opid]) => opid);
}

async function collectAndInspect(
  tabId: number,
  url: string,
  credential: Parameters<typeof generateLoginFillScript>[1],
): Promise<
  | { ok: true; fillScript: FillMessage["fillScript"]; documentNonce: string }
  | { ok: false; status: FillResult["status"] }
> {
  await ensureContentScript(tabId);

  const collected = (await chrome.tabs.sendMessage(
    tabId,
    { command: CollectCommand, expectedUrl: url },
    { frameId: TOP_FRAME },
  )) as CollectResponse | undefined;
  if (!collected?.ok) {
    return { ok: false, status: "page_changed" };
  }

  const fillScript = generateLoginFillScript(collected.pageDetails, credential, fillOptions);
  const opids = filledOpids(fillScript);
  if (opids.length === 0) {
    return { ok: false, status: "no_fields" };
  }

  const inspected = (await chrome.tabs.sendMessage(
    tabId,
    { command: InspectCommand, expectedUrl: url, opids } satisfies InspectMessage,
    { frameId: TOP_FRAME },
  )) as InspectResponse | undefined;
  if (!inspected?.ok) {
    return { ok: false, status: "page_changed" };
  }
  if (inspected.formless || submitTargetsLeaveOrigin(inspected.submitTargets, url)) {
    return { ok: false, status: "refused_form_action" };
  }

  return { ok: true, fillScript, documentNonce: collected.documentNonce };
}

const placeholder = { username: "x", password: "x" };

/**
 * Fills the login in the top frame of a tab. The origin and URL come from the browser's record
 * of the tab, never from the caller, who may only pin the origin they expect. The result carries
 * a status only.
 */
export async function fillLoginInTab(
  tabId: number,
  source: CredentialSource,
  expectedOrigin?: string,
): Promise<FillResult> {
  if (fillInFlight) {
    return { status: "busy" };
  }
  fillInFlight = true;
  try {
    const url = await topFrameUrl(tabId);
    const origin = approvedOrigin(url, __TEST_BUILD__);
    if (url == null || origin == null || (expectedOrigin != null && expectedOrigin !== origin)) {
      return { status: "refused_origin" };
    }
    if ((cooldownUntil.get(origin) ?? 0) > Date.now()) {
      return { status: "not_filled" };
    }

    // The credential is requested only after the page looks fillable and safe to submit, so the
    // user is not prompted for a page that would be refused.
    const probe = await collectAndInspect(tabId, url, placeholder);
    if (probe.ok === false) {
      return { status: probe.status };
    }

    const credential = await source.request(origin);
    if (credential == null) {
      cooldownUntil.set(origin, Date.now() + NOT_FILLED_COOLDOWN_MS);
      return { status: "not_filled" };
    }

    // The user may have taken minutes to approve, so the page is inspected again and the script
    // is rebuilt from what is there now.
    if ((await topFrameUrl(tabId)) !== url) {
      return { status: "page_changed" };
    }
    const fresh = await collectAndInspect(tabId, url, credential);
    if (fresh.ok === false) {
      return { status: fresh.status };
    }
    if (fresh.documentNonce !== probe.documentNonce) {
      return { status: "page_changed" };
    }

    const response = (await chrome.tabs.sendMessage(
      tabId,
      {
        command: FillCommand,
        expectedUrl: url,
        documentNonce: fresh.documentNonce,
        fillScript: fresh.fillScript,
      } satisfies FillMessage,
      { frameId: TOP_FRAME },
    )) as FillResponse | undefined;

    return response?.ok
      ? { status: "ok", filledFields: filledOpids(fresh.fillScript).length, origin }
      : { status: "page_changed" };
  } catch (error) {
    if (error instanceof CredentialRequestError) {
      return { status: error.kind === "denied" ? "not_filled" : error.kind };
    }
    return { status: "error" };
  } finally {
    fillInFlight = false;
  }
}
