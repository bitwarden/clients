import { mock } from "jest-mock-extended";
import { BehaviorSubject, EMPTY, Observable, Subject } from "rxjs";

import type { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import type { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import type { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import type { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import type { UserId } from "@bitwarden/common/types/guid";
import type { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import type { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillOutcome } from "../../enums/autofill-outcome.enum";
import type { LiveFrame } from "../../lifecycle/transition-buffer";
import type { AutofillService, PageDetail } from "../../services/abstractions/autofill.service";

import type { FillContext, FillRequest, FillTarget } from "./context";
import { CipherSource, FillRequestKind } from "./enums";
import type { FillBrowser, FillServices } from "./services";
import type { FillFilled } from "./types";

// Fakes for the workflow's specs.

export const NOW = 1_000_000;
export const TAB_ID = 7;
export const USER = "user-1" as UserId;
export const OTHER_USER = "user-2" as UserId;
export const URL = "https://example.com/login";
export const TOP_DOCUMENT = "top-document";
export const FRAME_DOCUMENT = "frame-document";
export const FILLED: FillFilled = Object.freeze({ outcome: AutofillOutcome.Filled });

export const tab: chrome.tabs.Tab = { id: TAB_ID, url: URL } as chrome.tabs.Tab;

/** A cipher with an id, and optionally a reprompt and a launch time. */
export function cipherOf(
  id: string,
  fields: Partial<Pick<CipherView, "reprompt">> & { lastLaunched?: number } = {},
): CipherView {
  return {
    id,
    reprompt: fields.reprompt ?? 0,
    localData:
      fields.lastLaunched === undefined ? undefined : { lastLaunched: fields.lastLaunched },
  } as unknown as CipherView;
}

/** The details of a frame that offers `fields` fields. */
export function pageDetail(frameId: number, fields: number): PageDetail {
  return {
    frameId,
    tab,
    details: { fields: Array.from({ length: fields }, () => ({})) },
  } as unknown as PageDetail;
}

/** A target on tab `TAB_ID`, for every frame of it, that holds `TOP_DOCUMENT`. */
export const tabTarget: FillTarget = Object.freeze({
  tabId: TAB_ID,
  tab,
  frameId: undefined,
  url: URL,
  documentId: TOP_DOCUMENT,
});

/** An eager fill's target on tab `TAB_ID`, reported by frame 3 holding `FRAME_DOCUMENT`. */
export const reportedTarget: FillTarget = Object.freeze({
  ...tabTarget,
  frameId: 3,
  report: { frameId: 3, documentId: FRAME_DOCUMENT, expiresAt: NOW + 1 },
});

/** A request of each kind, for `USER` and tab `TAB_ID`. */
export const requests = Object.freeze({
  reported: (report: Partial<Extract<FillRequest, { kind: "reported" }>["report"]> = {}) =>
    ({
      kind: FillRequestKind.Reported,
      userId: USER,
      report: {
        tabId: TAB_ID,
        frameId: 3,
        documentId: FRAME_DOCUMENT,
        expiresAt: NOW + 1,
        url: URL,
        ...report,
      },
    }) satisfies FillRequest as FillRequest,
  /** A tab request. Without an argument, its top frame holds `TOP_DOCUMENT`; `undefined` is gone. */
  tab: (...topFrame: [] | [LiveFrame | undefined]) =>
    ({
      kind: FillRequestKind.Tab,
      userId: USER,
      tab,
      topFrame: Promise.resolve(topFrame.length ? topFrame[0] : { documentId: TOP_DOCUMENT }),
    }) satisfies FillRequest as FillRequest,
  cipher: (cipher: CipherView = cipherOf("requested")) =>
    ({
      kind: FillRequestKind.Cipher,
      userId: USER,
      tab,
      topFrame: Promise.resolve({ documentId: TOP_DOCUMENT }),
      cipher,
    }) satisfies FillRequest as FillRequest,
  page: (
    pageDetails: PageDetail[] = [pageDetail(0, 1)],
    cipher: CipherView = cipherOf("requested"),
  ) =>
    ({
      kind: FillRequestKind.Page,
      userId: USER,
      tab,
      topFrame: Promise.resolve({ documentId: TOP_DOCUMENT }),
      cipher,
      pageDetails,
    }) satisfies FillRequest as FillRequest,
});

/** A whole context: a tab request, its target and page, and a login selected for it. */
export function contextOf(overrides: Partial<FillContext> = {}): FillContext {
  return {
    ...requests.tab(),
    target: tabTarget,
    page: [pageDetail(0, 1)],
    selection: { cipher: cipherOf("selected"), source: CipherSource.Login, rotation: URL },
    ...overrides,
  } as FillContext;
}

/**
 * Services for tab `TAB_ID`: it is the active tab, monitoring, holding `TOP_DOCUMENT` in frame 0 and
 * `FRAME_DOCUMENT` in frame 3. `USER` is the active account, and unlocked. A collect answers with
 * whatever a test sends on `collected$`, and never completes, as the browser's does. Every other tab
 * is gone.
 */
export function fakeServices() {
  const frames = new Map<number, LiveFrame | undefined>([
    [0, { documentId: TOP_DOCUMENT }],
    [3, { documentId: FRAME_DOCUMENT }],
  ]);
  const state = {
    liveTab: tab as chrome.tabs.Tab | undefined,
    activeTab: { ...tab } as chrome.tabs.Tab | undefined,
  };
  const browser = mock<FillBrowser>();
  browser.tab.mockImplementation(async (tabId) => (tabId === TAB_ID ? state.liveTab : undefined));
  browser.frame.mockImplementation(async (tabId, frameId) =>
    tabId === TAB_ID ? frames.get(frameId) : undefined,
  );
  browser.activeTab.mockImplementation(async () => state.activeTab);

  const monitoring$ = new BehaviorSubject(true);
  const activeAccount$ = new BehaviorSubject<Account | null>({ id: USER } as Account);
  const status$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
  const collected$ = new Subject<PageDetail[]>();

  const accountService = mock<AccountService>();
  // A real subject: a mock's proxy of an observable does not emit.
  accountService.activeAccount$ = activeAccount$;
  accountService.setAccountActivity.mockResolvedValue();
  const authService = mock<AuthService>();
  authService.authStatusFor$.mockImplementation((userId) =>
    userId === USER ? status$ : new BehaviorSubject(AuthenticationStatus.LoggedOut),
  );
  const autofillService = mock<AutofillService>();
  autofillService.collectPageDetailsFromTab$.mockReturnValue(collected$);
  autofillService.doAutoFill.mockResolvedValue(FILLED);
  autofillService.isPasswordRepromptRequired.mockResolvedValue(false);
  const cipherService = mock<CipherService>();
  const logService = mock<LogService>();
  const platformUtilsService = mock<PlatformUtilsService>();
  const updateOverlayCiphers = jest.fn(async (): Promise<void> => undefined);

  const services: FillServices = {
    browser,
    monitoring$: (tabId: number): Observable<boolean> => (tabId === TAB_ID ? monitoring$ : EMPTY),
    accountService,
    authService,
    autofillService,
    cipherService,
    logService,
    platformUtilsService,
    updateOverlayCiphers,
    now: () => NOW,
  };
  return {
    services,
    browser,
    frames,
    monitoring$,
    activeAccount$,
    status$,
    collected$,
    accountService,
    authService,
    autofillService,
    cipherService,
    logService,
    platformUtilsService,
    updateOverlayCiphers,
    closeTab: () => {
      state.liveTab = undefined;
    },
    activate: (next: chrome.tabs.Tab | undefined) => {
      state.activeTab = next;
    },
  };
}
export type FakeServices = ReturnType<typeof fakeServices>;
