import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import {
  AUTOFILL_CARD_ID,
  AUTOFILL_ID,
  AUTOFILL_IDENTITY_ID,
  AUTOFILL_TRIAGE_ID,
  COPY_IDENTIFIER_ID,
  COPY_PASSWORD_ID,
  COPY_USERNAME_ID,
  COPY_VERIFICATION_CODE_ID,
  CREATE_CARD_ID,
  CREATE_IDENTITY_ID,
  CREATE_LOGIN_ID,
  ExtensionCommand,
  GENERATE_PASSWORD_ID,
  NOOP_COMMAND_SUFFIX,
} from "@bitwarden/common/autofill/constants";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openUnlockPopout } from "../../auth/popup/utils/auth-popout-window";
import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";
import { TabMessage } from "../../types/tab-messages";
// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import {
  openAddEditVaultItemPopout,
  openVaultItemPasswordRepromptPopout,
} from "../../vault/popup/utils/vault-popout-window";
import { AutofillTriageService } from "../services/abstractions/autofill-triage.service";
import { WebmapperDraftService } from "../services/webmapper-draft.service";
import { AutofillCipherTypeId } from "../types";
import {
  AutofillTriageBrowserInfo,
  AutofillTriagePageResult,
  AutofillTriageResponse,
} from "../types/autofill-triage";
import {
  addSelector,
  ContainerCandidate,
  fieldSelectorsForActive,
  SelectorEntry,
  setPendingContainer,
  Slot,
  toggleIrrelevant,
} from "../webmapper/draft";
import { isWebmapperMenuId, parseWebmapperMenuId, WebmapperMenuAction } from "../webmapper/menu";
import { WebmapperCommand, WebmapperContainerCandidatesResponse } from "../webmapper/messaging";
import { GeneratedSelector } from "../webmapper/selector";
import { ParsedUrl, parseUrl } from "../webmapper/url";

export type CopyToClipboardOptions = { text: string; tab: chrome.tabs.Tab };
export type CopyToClipboardAction = (options: CopyToClipboardOptions) => void;
export type AutofillAction = (tab: chrome.tabs.Tab, cipher: CipherView) => Promise<void>;

export type GeneratePasswordToClipboardAction = (tab: chrome.tabs.Tab) => Promise<void>;

export class ContextMenuClickedHandler {
  private _triageResult: AutofillTriagePageResult | undefined;

  get triageResult(): AutofillTriagePageResult | undefined {
    return this._triageResult;
  }

  /**
   * Returns the stored triage result for the given tab and clears it from memory.
   * Returns undefined if no result is stored or the tabId doesn't match.
   * Call this when handing the result to the popup so it doesn't linger in
   * the background after it has been consumed.
   */
  consumeTriageResult(tabId: number): AutofillTriagePageResult | undefined {
    if (this._triageResult?.tabId !== tabId) {
      return undefined;
    }
    const result = this._triageResult;
    this._triageResult = undefined;
    return result;
  }

  constructor(
    private copyToClipboard: CopyToClipboardAction,
    private generatePasswordToClipboard: GeneratePasswordToClipboardAction,
    private autofillAction: AutofillAction,
    private authService: AuthService,
    private cipherService: CipherService,
    private totpService: TotpService,
    private eventCollectionService: EventCollectionService,
    private userVerificationService: UserVerificationService,
    private accountService: AccountService,
    private triageService: AutofillTriageService,
    private webmapperDrafts: WebmapperDraftService,
  ) {}

  async run(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
    if (!tab) {
      return;
    }

    const menuItemId = String(info.menuItemId);
    if (isWebmapperMenuId(menuItemId)) {
      await this.webmapperAction(menuItemId, info, tab);
      return;
    }

    switch (info.menuItemId) {
      case GENERATE_PASSWORD_ID:
        await this.generatePasswordToClipboard(tab);
        break;
      case COPY_IDENTIFIER_ID:
        if (!tab.id) {
          return;
        }

        this.copyToClipboard({ text: await this.getIdentifier(tab, info), tab: tab });
        break;
      case AUTOFILL_TRIAGE_ID:
        await this.autofillTriageAction(info, tab);
        break;
      default:
        await this.cipherAction(info, tab);
    }
  }

  async cipherAction(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
    if (!tab) {
      return;
    }

    if ((await this.authService.getAuthStatus()) < AuthenticationStatus.Unlocked) {
      await openUnlockPopout(tab, {
        commandToRetry: {
          message: { command: ExtensionCommand.NoopCommand, contextMenuOnClickData: info },
          sender: { tab: tab },
        },
        target: "contextmenus.background",
      });
      return;
    }

    // NOTE: We don't actually use the first part of this ID, we further switch based on the parentMenuItemId
    // I would really love to not add it but that is a departure from how it currently works.
    const menuItemId = (info.menuItemId as string).split("_")[1]; // We create all the ids, we can guarantee they are strings
    let cipher: CipherView | undefined;
    const isCreateCipherAction = [CREATE_LOGIN_ID, CREATE_IDENTITY_ID, CREATE_CARD_ID].includes(
      menuItemId as string,
    );

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (activeUserId == null) {
      return;
    }

    if (isCreateCipherAction) {
      // pass; defer to logic below
    } else if (menuItemId === NOOP_COMMAND_SUFFIX) {
      if (!tab.url) {
        return;
      }

      const additionalCiphersToGet =
        info.parentMenuItemId === AUTOFILL_IDENTITY_ID
          ? [CipherType.Identity]
          : info.parentMenuItemId === AUTOFILL_CARD_ID
            ? [CipherType.Card]
            : [];

      // This NOOP item has come through which is generally only for no access state but since we got here
      // we are actually unlocked we will do our best to find a good match of an item to autofill this is useful
      // in scenarios like unlock on autofill
      const ciphers = await this.cipherService.getAllDecryptedForUrl(
        tab.url,
        activeUserId,
        additionalCiphersToGet,
      );

      cipher = ciphers[0];
    } else {
      const ciphers = await this.cipherService.getAllDecrypted(activeUserId);
      cipher = ciphers.find(({ id }) => id === menuItemId);
    }

    if (!cipher && !isCreateCipherAction) {
      return;
    }

    await this.accountService.setAccountActivity(activeUserId, new Date());
    switch (info.parentMenuItemId) {
      case AUTOFILL_ID:
      case AUTOFILL_IDENTITY_ID:
      case AUTOFILL_CARD_ID: {
        const cipherType = this.getCipherCreationType(menuItemId);

        if (cipherType) {
          await openAddEditVaultItemPopout(tab, { cipherType });
          break;
        }

        if (!cipher) {
          break;
        }

        if (await this.isPasswordRepromptRequired(cipher)) {
          await openVaultItemPasswordRepromptPopout(tab, {
            cipherId: cipher.id,
            // The action here is passed on to the single-use reprompt window and doesn't change based on cipher type
            action: AUTOFILL_ID,
          });
        } else {
          await this.autofillAction(tab, cipher);
        }

        break;
      }
      case COPY_USERNAME_ID:
        if (menuItemId === CREATE_LOGIN_ID) {
          await openAddEditVaultItemPopout(tab, { cipherType: CipherType.Login });
          break;
        }

        if (!cipher || !cipher.login?.username) {
          break;
        }

        this.copyToClipboard({ text: cipher.login.username, tab: tab });
        break;
      case COPY_PASSWORD_ID:
        if (menuItemId === CREATE_LOGIN_ID) {
          await openAddEditVaultItemPopout(tab, { cipherType: CipherType.Login });
          break;
        }

        if (!cipher || !cipher.login?.password) {
          break;
        }

        if (await this.isPasswordRepromptRequired(cipher)) {
          await openVaultItemPasswordRepromptPopout(tab, {
            cipherId: cipher.id,
            action: COPY_PASSWORD_ID,
          });
        } else {
          this.copyToClipboard({ text: cipher.login.password, tab: tab });

          void this.eventCollectionService.collect(
            EventType.Cipher_ClientCopiedPassword,
            cipher.id,
          );
        }

        break;
      case COPY_VERIFICATION_CODE_ID:
        if (menuItemId === CREATE_LOGIN_ID) {
          await openAddEditVaultItemPopout(tab, { cipherType: CipherType.Login });
          break;
        }

        if (!cipher || !cipher.login?.totp) {
          break;
        }

        if (await this.isPasswordRepromptRequired(cipher)) {
          await openVaultItemPasswordRepromptPopout(tab, {
            cipherId: cipher.id,
            action: COPY_VERIFICATION_CODE_ID,
          });
        } else {
          const totpResponse = await firstValueFrom(this.totpService.getCode$(cipher.login.totp));
          this.copyToClipboard({
            text: totpResponse.code,
            tab: tab,
          });
        }

        break;
    }
  }

  private async autofillTriageAction(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
    if (!tab.id) {
      return;
    }

    if (BrowserApi.isSidePanelApiSupported) {
      // Open the UI immediately to preserve the user gesture required by sidePanel.open().
      // setSidePanelOptions must NOT be awaited before openSidePanel — awaiting would yield
      // the event loop and expire the gesture token. Both IPC calls are dispatched in the
      // same synchronous context; Chrome processes extension IPC in order, so setOptions
      // is guaranteed to complete before open.
      void BrowserApi.setSidePanelOptions({
        path: "popup/index.html?uilocation=sidepanel#/autofill-triage",
        tabId: tab.id,
        enabled: true,
      });
      await BrowserApi.openSidePanel({ tabId: tab.id });
    } else {
      await BrowserPopupUtils.openPopout("popup/index.html#/autofill-triage", {
        singleActionKey: AUTOFILL_TRIAGE_ID,
        senderWindowId: tab.windowId,
      });
    }

    const response = await this.collectPageDetailsForTriage(tab, info);
    if (!response) {
      await BrowserApi.sendMessage("triageResultReady", { tabId: tab.id });
      return;
    }

    const fields = response.pageDetails.fields.map((field) =>
      this.triageService.triageField(field, response.pageDetails),
    );

    this._triageResult = {
      tabId: tab.id,
      pageUrl: tab.url ?? "",
      analyzedAt: new Date(),
      targetElementRef: response.targetFieldRef,
      fields,
      pageContext: {
        title: response.pageDetails.title,
        documentUrl: response.pageDetails.documentUrl,
        totalForms: Object.keys(response.pageDetails.forms).length,
        totalFields: response.pageDetails.fields.length,
        collectedTimestamp: response.pageDetails.collectedTimestamp,
      },
      extensionVersion: chrome.runtime.getManifest().version,
      browserInfo: this.getBrowserInfo(),
    };

    await BrowserApi.sendMessage("triageResultReady", { tabId: tab.id });
  }

  private collectPageDetailsForTriage(
    tab: chrome.tabs.Tab,
    info: chrome.contextMenus.OnClickData,
  ): Promise<AutofillTriageResponse | null> {
    return new Promise<AutofillTriageResponse | null>((resolve) => {
      BrowserApi.sendTabsMessage<AutofillTriageResponse>(
        tab.id!,
        { command: "collectAutofillTriage" },
        { frameId: info.frameId },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response ?? null);
        },
      );
    });
  }

  // ---------- webmapper ----------

  private async webmapperAction(
    menuItemId: string,
    info: chrome.contextMenus.OnClickData,
    tab: chrome.tabs.Tab,
  ) {
    if (!tab.id) {
      return;
    }
    const action = parseWebmapperMenuId(menuItemId);
    if (!action) {
      // A non-actionable parent/group item — nothing to do.
      return;
    }

    // Open the panel first, while the user gesture is still valid (same ordering
    // constraint as autofillTriageAction).
    await this.openWebmapperPanel(tab);

    const parsed = tab.url ? parseUrl(tab.url) : null;
    if (!parsed) {
      await this.sendWebmapperFeedback(tab.id, "error", "Webmapper only works on http(s) pages.");
      return;
    }

    switch (action.kind) {
      case "toggle-irrelevant": {
        const next = await this.webmapperDrafts.updateDraft(
          parsed.host,
          parsed.pathname,
          toggleIrrelevant,
        );
        await this.sendWebmapperFeedback(
          tab.id,
          "success",
          next.irrelevant ? "Marked page irrelevant" : "Cleared irrelevant flag",
        );
        return;
      }
      case "set-container":
        await this.webmapperPickContainer(parsed, tab, info);
        return;
      case "field":
      case "action":
        await this.webmapperCapture(parsed, tab, info, action);
        return;
    }
  }

  private async openWebmapperPanel(tab: chrome.tabs.Tab) {
    if (tab.id == null) {
      return;
    }
    if (BrowserApi.isSidePanelApiSupported) {
      void BrowserApi.setSidePanelOptions({
        path: "popup/index.html?uilocation=sidepanel#/autofill-triage?view=webmapper",
        tabId: tab.id,
        enabled: true,
      });
      await BrowserApi.openSidePanel({ tabId: tab.id });
    } else {
      await BrowserPopupUtils.openPopout("popup/index.html#/autofill-triage?view=webmapper", {
        singleActionKey: AUTOFILL_TRIAGE_ID,
        senderWindowId: tab.windowId,
      });
    }
  }

  private async webmapperCapture(
    parsed: ParsedUrl,
    tab: chrome.tabs.Tab,
    info: chrome.contextMenus.OnClickData,
    action: Extract<WebmapperMenuAction, { key: string }>,
  ) {
    const capture = await this.webmapperGetSelector(tab, info);
    if (!capture) {
      await this.sendWebmapperFeedback(
        tab.id!,
        "error",
        "No content script in this frame. Reload the page and try again.",
      );
      return;
    }
    if (!capture.selector) {
      await this.sendWebmapperFeedback(
        tab.id!,
        "error",
        "Couldn't generate a selector (no element captured).",
      );
      return;
    }

    const captured: SelectorEntry = {
      selector: capture.selector,
      warnings: capture.warnings ?? [],
      alternates: capture.alternates ?? [],
    };
    const slot: Slot = {
      kind: action.kind === "field" ? "fields" : "actions",
      key: action.key,
    };
    // Written through updateDraft, not a read-modify-write: the selector round trip
    // above is long enough for the open panel to have persisted an edit meanwhile.
    await this.webmapperDrafts.updateDraft(parsed.host, parsed.pathname, (d) =>
      addSelector(d, slot, captured),
    );

    const warnCount = captured.warnings.length;
    const warnSuffix = warnCount ? ` (${warnCount} warning${warnCount === 1 ? "" : "s"})` : "";
    await this.sendWebmapperFeedback(
      tab.id!,
      "success",
      `Captured ${action.kind}:${action.key} — ${capture.selector}${warnSuffix}`,
    );
  }

  private async webmapperPickContainer(
    parsed: ParsedUrl,
    tab: chrome.tabs.Tab,
    info: chrome.contextMenus.OnClickData,
  ) {
    // Read only to seed the candidate walk; the write below re-reads.
    const draft = await this.webmapperDrafts.getDraft(parsed.host, parsed.pathname);
    const candidates = await this.webmapperGetContainerCandidates(
      tab,
      info,
      fieldSelectorsForActive(draft),
    );
    if (candidates == null) {
      await this.sendWebmapperFeedback(
        tab.id!,
        "error",
        "No content script in this frame. Reload the page and try again.",
      );
      return;
    }
    if (candidates.length === 0) {
      await this.sendWebmapperFeedback(
        tab.id!,
        "error",
        "Right-click an element on the page first.",
      );
      return;
    }
    await this.webmapperDrafts.updateDraft(parsed.host, parsed.pathname, (d) =>
      setPendingContainer(d, candidates),
    );
    await this.sendWebmapperFeedback(
      tab.id!,
      "success",
      `Pick a container in the panel (${candidates.length} candidate${
        candidates.length === 1 ? "" : "s"
      })`,
    );
  }

  // Ask the content script in the clicked frame for a capture. Resolves null
  // when no content script answers (chrome.runtime.lastError) so callers can
  // tell "no script here" apart from a script that responded with no result.
  private webmapperSend<T>(
    tab: chrome.tabs.Tab,
    info: chrome.contextMenus.OnClickData,
    message: TabMessage,
  ): Promise<T | null> {
    return new Promise((resolve) => {
      BrowserApi.sendTabsMessage<T>(tab.id!, message, { frameId: info.frameId }, (response) => {
        resolve(chrome.runtime.lastError ? null : (response ?? null));
      });
    });
  }

  private webmapperGetSelector(
    tab: chrome.tabs.Tab,
    info: chrome.contextMenus.OnClickData,
  ): Promise<GeneratedSelector | null> {
    return this.webmapperSend<GeneratedSelector>(tab, info, {
      command: WebmapperCommand.GetSelector,
    });
  }

  private async webmapperGetContainerCandidates(
    tab: chrome.tabs.Tab,
    info: chrome.contextMenus.OnClickData,
    fieldSelectors: string[],
  ): Promise<ContainerCandidate[] | null> {
    const response = await this.webmapperSend<WebmapperContainerCandidatesResponse>(tab, info, {
      command: WebmapperCommand.GetContainerCandidates,
      fieldSelectors,
    });
    return response ? (response.candidates ?? []) : null;
  }

  private async sendWebmapperFeedback(
    tabId: number,
    type: "success" | "error",
    message: string,
  ): Promise<void> {
    await BrowserApi.sendMessage("webmapperCaptureFeedback", { tabId, type, message });
  }

  private async isPasswordRepromptRequired(cipher: CipherView): Promise<boolean> {
    return (
      cipher.reprompt === CipherRepromptType.Password &&
      (await this.userVerificationService.hasMasterPassword())
    );
  }

  /**
   * Gets browser information for version tracking.
   */
  private getBrowserInfo(): AutofillTriageBrowserInfo {
    const userAgent = navigator.userAgent;
    let name = "Unknown";
    let version = "Unknown";

    // Detect browser name and version
    if (userAgent.includes("Edg/")) {
      name = "Edge";
      const match = userAgent.match(/Edg\/([\d.]+)/);
      version = match ? match[1] : "Unknown";
    } else if (userAgent.includes("Chrome/")) {
      name = "Chrome";
      const match = userAgent.match(/Chrome\/([\d.]+)/);
      version = match ? match[1] : "Unknown";
    } else if (userAgent.includes("Firefox/")) {
      name = "Firefox";
      const match = userAgent.match(/Firefox\/([\d.]+)/);
      version = match ? match[1] : "Unknown";
    } else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome")) {
      name = "Safari";
      const match = userAgent.match(/Version\/([\d.]+)/);
      version = match ? match[1] : "Unknown";
    }

    return { name, version };
  }

  private getCipherCreationType(menuItemId?: string): AutofillCipherTypeId | null {
    return menuItemId === CREATE_IDENTITY_ID
      ? CipherType.Identity
      : menuItemId === CREATE_CARD_ID
        ? CipherType.Card
        : menuItemId === CREATE_LOGIN_ID
          ? CipherType.Login
          : null;
  }

  private async getIdentifier(tab: chrome.tabs.Tab, info: chrome.contextMenus.OnClickData) {
    const tabId = tab.id!;
    return new Promise<string>((resolve, reject) => {
      BrowserApi.sendTabsMessage(
        tabId,
        { command: "getClickedElement" },
        { frameId: info.frameId },
        (identifier: string) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          resolve(identifier);
        },
      );
    });
  }
}
