import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  AutoFillOptions,
  AutoFillResult,
  PageDetail,
} from "../../services/abstractions/autofill.service";
import { AutofillTriageResponse } from "../../types/autofill-triage";

/**
 * The single owner of fill execution in the background. It reduces every fill request — page load,
 * keyboard command, card / identity, caller-supplied cipher, and auto-submit — to one concrete
 * instruction for the autofill service, serializes execution per `(tab, frame)`, and upholds the
 * fill invariants (correct origin, foreground/active tab). See `orchestrator.design.md`.
 *
 * The default implementation is `DefaultAutofillOrchestrator`.
 */
export abstract class AutofillOrchestrator {
  /**
   * Wires the orchestrator's listeners and reactive pipelines. Call once, when the background
   * starts, after the lifecycle service is initialized.
   */
  abstract init(): void;

  /**
   * Fills the active tab from a keyboard shortcut, running the login side effects a keyboard fill
   * shares with a page-load fill: TOTP clipboard copy and overlay-cipher refresh.
   */
  abstract autofillActiveTabFromCommand(tab: chrome.tabs.Tab): void;

  /**
   * Fills the active tab with the next card or identity cipher of the given type. Carries none of
   * the TOTP-copy / overlay-refresh side effects of a login fill.
   */
  abstract autofillActiveTabForCipherType(tab: chrome.tabs.Tab, cipherType: CipherType): void;

  /**
   * Collects a tab's page details for an external, one-shot caller (the popup collect, the
   * inline-menu focused-field collect). Resolves once the collection settles, or with an empty
   * array when the tab does not respond.
   *
   * @param tab The tab to collect from
   * @param frameId When set, collect only this frame; otherwise every frame
   */
  abstract collectPageDetails(tab: chrome.tabs.Tab, frameId?: number): Promise<PageDetail[]>;

  /**
   * Collects autofill-triage analysis for a tab. Resolves with `undefined` when the tab has no
   * receiver or does not respond.
   *
   * @param tabId The tab to analyze
   * @param frameId When set, analyze only this frame
   */
  abstract collectAutofillTriage(
    tabId: number,
    frameId?: number,
  ): Promise<AutofillTriageResponse | undefined>;

  /**
   * Fills a caller-supplied cipher into a tab, skipping page-detail collection — the entry for
   * externally-initiated fills (inline menu, generated password, etc.) that bring their own cipher
   * and page details. Use {@link autofillTabWithCipher} when a collection has not completed first.
   *
   * Reports whether a fill ran and the TOTP to copy; a tab that is not the foreground/active tab
   * runs no fill (use {@link unsafeAutofillTabWithCipher} to bypass that check).
   */
  abstract fillCipher(options: AutoFillOptions): Promise<AutoFillResult>;

  /**
   * Collects a tab's page details and fills the given cipher into it.
   *
   * Reports whether a fill ran and the TOTP to copy; a tab with no page details to fill reports no
   * fill.
   */
  abstract autofillTabWithCipher(
    tab: chrome.tabs.Tab,
    cipher: CipherView,
    options?: Partial<AutoFillOptions>,
  ): Promise<AutoFillResult>;

  /**
   * Collects a tab's page details and fills the given cipher into it, omitting the active-tab
   * verification.
   *
   * DANGER: a fill from this method can land on a tab the user is not looking at. It must NEVER be
   * reachable from a message a content script can place. Call it only after confirming the sender is
   * an extension page.
   *
   * Reports whether a fill ran and the TOTP to copy; a tab with no page details to fill reports no
   * fill.
   */
  abstract unsafeAutofillTabWithCipher(
    tab: chrome.tabs.Tab,
    cipher: CipherView,
    options?: Partial<AutoFillOptions>,
  ): Promise<AutoFillResult>;
}
