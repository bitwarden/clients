import {
  combineLatest,
  concatMap,
  debounceTime,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  take,
  timeout,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import {
  AgentFillFailure,
  AgentFillFailureReason,
  AgentFillHello,
  AgentFillHelloAccount,
  AgentFillResponse,
  AgentFillTopic,
  FillItemRequest,
  FillItemResponse,
  PrepareFillRequest,
  PrepareFillResponse,
} from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { IncomingMessage, OutgoingMessage, Source } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../platform/browser/browser-api";
import { AutofillService, PageDetail } from "../services/abstractions/autofill.service";
import { AgentFillSettingsService } from "../services/agent-fill-settings.service";

/** How long to wait for the tab's frames to report page details before filling. */
const PAGE_DETAILS_SETTLE_MS = 200;
const PAGE_DETAILS_TIMEOUT_MS = 3_000;

/**
 * PROTOTYPE: agent autofill with approval.
 *
 * Announces this browser to the desktop app with `Hello`, and answers `PrepareFill` and `FillItem`
 * requests from it over SDK IPC. The desktop app owns the approval; this class locates the tab,
 * then, after approval, re-checks the chosen item against the tab and fills it through the
 * existing autofill service. Requests are served only for the active account, and only while
 * that account allows agent fills in this browser. Credentials never leave the extension.
 */
export class AgentFillBackground {
  private subscription?: Subscription;
  private helloSubscription?: Subscription;

  constructor(
    private ipcService: IpcService,
    private autofillService: AutofillService,
    private cipherService: CipherService,
    private accountService: AccountService,
    private authService: AuthService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private agentFillSettingsService: AgentFillSettingsService,
    /** Emits each time the desktop connection is (re-)established. */
    private desktopConnected$: Observable<void>,
  ) {}

  /** Must run after {@link IpcService.init}. */
  init() {
    if (this.platformUtilsService.isSafari()) {
      return;
    }

    try {
      this.subscribe();
      this.startHello();
    } catch (e) {
      this.logService.error("[AgentFill] IPC is not available", e);
    }
  }

  private subscribe() {
    this.subscription = this.ipcService.messages$
      .pipe(
        filter(
          (message) =>
            message.topic === AgentFillTopic.PrepareFill ||
            message.topic === AgentFillTopic.FillItem,
        ),
        // Only the desktop app may drive fills. Other local processes can reach only the desktop.
        filter((message) => {
          const trusted = isDesktopSource(message.source);
          if (!trusted) {
            this.logService.warning(
              "[AgentFill] Ignoring request from untrusted source",
              JSON.stringify(message.source),
            );
          }
          return trusted;
        }),
        // One fill at a time, in order.
        concatMap(async (message) => {
          await this.handle(message);
        }),
      )
      .subscribe({
        error: (e: unknown) => this.logService.error("[AgentFill] Request stream stopped", e),
      });
  }

  destroy() {
    this.subscription?.unsubscribe();
    this.helloSubscription?.unsubscribe();
  }

  /**
   * The latest Hello: re-emits on account list, active account, and setting changes. Paired with
   * {@link desktopConnected$} so it is also re-sent on every (re)connect.
   */
  hello$(): Observable<AgentFillHello> {
    const accounts$: Observable<AgentFillHelloAccount[]> = this.accountService.accounts$.pipe(
      map((accounts) => Object.keys(accounts ?? {}) as UserId[]),
      distinctUntilChanged((a, b) => a.length === b.length && a.every((id, i) => id === b[i])),
      switchMap((userIds) =>
        userIds.length === 0
          ? of([])
          : combineLatest(
              userIds.map((userId) =>
                this.agentFillSettingsService
                  .agentFillAllowed$(userId)
                  .pipe(map((agentFillAllowed) => ({ userId, agentFillAllowed }))),
              ),
            ),
      ),
    );
    const activeUserId$ = this.accountService.activeAccount$.pipe(
      getOptionalUserId,
      distinctUntilChanged(),
    );

    return combineLatest([accounts$, activeUserId$]).pipe(
      concatMap(async ([accounts, activeUserId]) => ({
        browser: this.platformUtilsService.getDeviceString(),
        extensionVersion: await this.platformUtilsService.getApplicationVersion(),
        activeUserId,
        accounts,
      })),
    );
  }

  private startHello() {
    this.helloSubscription = combineLatest([this.hello$(), this.desktopConnected$])
      .pipe(
        concatMap(async ([hello]) => {
          try {
            await this.ipcService.send(
              OutgoingMessage.new_json_payload(hello, "DesktopMain", AgentFillTopic.Hello),
            );
            this.logService.info(
              `[AgentFill] Hello sent: ${hello.accounts.length} account(s), ` +
                `${hello.accounts.filter((a) => a.agentFillAllowed).length} allowing agent fills`,
            );
          } catch (e) {
            // The desktop app is not reachable; the next connect re-sends.
            this.logService.warning("[AgentFill] Hello not delivered", e);
          }
        }),
      )
      .subscribe({
        error: (e: unknown) => this.logService.error("[AgentFill] Hello stream stopped", e),
      });
  }

  private async handle(message: IncomingMessage) {
    const source = message.source as "DesktopMain" | "DesktopRenderer";
    let requestId = "";
    let response: AgentFillResponse;
    try {
      const payload = message.parse_payload_as_json();
      requestId = String(payload?.requestId ?? "");
      response =
        (await this.checkAllowed(requestId, payload?.userId)) ??
        (message.topic === AgentFillTopic.PrepareFill
          ? await this.prepareFill(payload as PrepareFillRequest)
          : await this.fillItem(payload as FillItemRequest));
    } catch (e) {
      this.logService.error("[AgentFill] Request failed", e);
      response = failure(requestId, AgentFillFailureReason.Error, "The extension hit an error.");
    }

    try {
      await this.ipcService.send(
        OutgoingMessage.new_json_payload(response, source, AgentFillTopic.Response),
      );
    } catch (e) {
      this.logService.error("[AgentFill] Failed to send response", e);
    }
  }

  /**
   * Agent fills are served only for the extension's active account, and only when that account
   * has turned on "Allow agents to fill in this browser". Returns a failure, or null to proceed.
   */
  private async checkAllowed(
    requestId: string,
    userId: string | undefined,
  ): Promise<AgentFillFailure | null> {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(getOptionalUserId),
    );
    if (userId == null || activeUserId !== userId) {
      return failure(
        requestId,
        AgentFillFailureReason.NoAllowedBrowser,
        "This browser's active Bitwarden account is not the requesting account.",
      );
    }
    if (!(await firstValueFrom(this.agentFillSettingsService.agentFillAllowed$(activeUserId)))) {
      return failure(
        requestId,
        AgentFillFailureReason.NoAllowedBrowser,
        "Agent fills are turned off in this browser for this account.",
      );
    }
    return null;
  }

  private async prepareFill(request: PrepareFillRequest): Promise<PrepareFillResponse> {
    const origin = safeOrigin(request.url);
    if (origin == null) {
      return failure(request.requestId, AgentFillFailureReason.NoOpenTab, "Invalid URL.");
    }

    const tabs = (await BrowserApi.tabsQuery({})).filter(
      (tab) => tab.id != null && safeOrigin(tab.url) === origin,
    );

    let tab: chrome.tabs.Tab | undefined;
    if (tabs.length === 1) {
      tab = tabs[0];
    } else if (tabs.length > 1) {
      const focused = await BrowserApi.tabsQuery({ active: true, lastFocusedWindow: true });
      tab = tabs.find((t) => focused.some((f) => f.id === t.id));
    }

    if (tab?.id == null || tab.url == null) {
      return failure(
        request.requestId,
        AgentFillFailureReason.NoOpenTab,
        tabs.length > 1
          ? "Several tabs are open for this site and none is active in the front window."
          : "No open tab for this site.",
      );
    }

    return {
      requestId: request.requestId,
      ok: true,
      tabId: tab.id,
      domain: Utils.getHostname(tab.url),
      tabUrl: tab.url,
      browser: this.platformUtilsService.getDeviceString(),
      unlocked: (await this.activeUnlockedUserId()) != null,
    };
  }

  private async fillItem(request: FillItemRequest): Promise<FillItemResponse> {
    const { requestId } = request;

    const userId = await this.activeUnlockedUserId();
    if (userId == null) {
      return failure(requestId, AgentFillFailureReason.Locked, "The extension is locked.");
    }

    // The tab can navigate between PrepareFill and FillItem, so re-read it.
    const tab = await this.getTab(request.tabId);
    if (tab?.url == null || Utils.getHostname(tab.url) !== request.expectedDomain) {
      return failure(
        requestId,
        AgentFillFailureReason.NoOpenTab,
        "The tab closed or left the approved site.",
      );
    }

    const [cipher] = await this.cipherService.getAllDecryptedForIds(userId, [request.cipherId]);
    if (cipher == null || cipher.isDeleted || cipher.type !== request.cipherType) {
      return failure(
        requestId,
        AgentFillFailureReason.NoMatchingItem,
        "The approved item is not in this browser's vault.",
      );
    }

    // Cards carry no URIs; logins must match the tab with the user's normal URI match rules.
    if (cipher.type === CipherType.Login) {
      const matches = await this.cipherService.filterCiphersForUrl([cipher], tab.url);
      if (matches.length === 0) {
        return failure(
          requestId,
          AgentFillFailureReason.NoMatchingItem,
          "The approved item's saved URIs do not match the tab.",
        );
      }
    }

    // PROTOTYPE: items that require a master password re-prompt are not filled for agents.
    if (cipher.reprompt !== CipherRepromptType.None) {
      return failure(
        requestId,
        AgentFillFailureReason.NoMatchingItem,
        "The approved item requires master password re-prompt.",
      );
    }

    const pageDetails = await firstValueFrom(
      this.autofillService
        .collectPageDetailsFromTab$(tab)
        .pipe(
          debounceTime(PAGE_DETAILS_SETTLE_MS),
          take(1),
          timeout({ first: PAGE_DETAILS_TIMEOUT_MS, with: () => of([] as PageDetail[]) }),
        ),
    );
    if (!pageDetails.some((pd) => pd.details?.fields?.length)) {
      return failure(requestId, AgentFillFailureReason.FormNotFound, "No form found on the page.");
    }

    const result = await this.autofillService.doAutoFill({
      tab,
      cipher,
      pageDetails,
      fillNewPassword: true,
      allowTotpAutofill: true,
    });
    if (!result.didAutofill) {
      return failure(
        requestId,
        AgentFillFailureReason.FormNotFound,
        "No fillable fields for this item on the page.",
      );
    }

    return { requestId, ok: true };
  }

  private async getTab(tabId: number): Promise<chrome.tabs.Tab | null> {
    try {
      return await BrowserApi.getTab(tabId);
    } catch {
      // The tab was closed.
      return null;
    }
  }

  private async activeUnlockedUserId() {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
    if (userId == null) {
      return null;
    }
    const status = await firstValueFrom(this.authService.authStatusFor$(userId));
    return status === AuthenticationStatus.Unlocked ? userId : null;
  }
}

function isDesktopSource(source: Source): boolean {
  return source === "DesktopMain" || source === "DesktopRenderer";
}

function safeOrigin(url: string | undefined): string | null {
  if (url == null) {
    return null;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function failure(requestId: string, reason: AgentFillFailureReason, message: string) {
  return { requestId, ok: false as const, reason, message };
}
