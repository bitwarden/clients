import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AgentFillTopic } from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BrowserApi } from "../../platform/browser/browser-api";
import { AutofillService } from "../services/abstractions/autofill.service";
import { AgentFillPendingRequestService } from "../services/agent-fill-pending-request.service";
import { AgentFillSettingsService } from "../services/agent-fill-settings.service";

import { AgentFillBackground } from "./agent-fill.background";

jest.mock("@bitwarden/sdk-internal", () => ({
  OutgoingMessage: {
    new_json_payload: (payload: unknown, destination: unknown, topic: string) => ({
      payload,
      destination,
      topic,
    }),
  },
}));

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const TAB = { id: 5, url: "https://www.delta.com/login", windowId: 1 } as chrome.tabs.Tab;
const OTHER_TAB = { id: 6, url: "https://united.com/", windowId: 1 } as chrome.tabs.Tab;

describe("AgentFillBackground", () => {
  let messages$: Subject<any>;
  let sent: Array<{ payload: any; destination: any; topic: string }>;
  let autofillService: jest.Mocked<AutofillService>;
  let cipherService: jest.Mocked<CipherService>;
  let cipher: CipherView;
  let desktopConnected$: Subject<void>;
  let allowed: Record<string, BehaviorSubject<boolean>>;
  let activeAccount$: BehaviorSubject<{ id: string } | null>;
  let flagEnabled$: BehaviorSubject<boolean>;
  let pendingRequestService: AgentFillPendingRequestService;
  let authService: jest.Mocked<AuthService>;
  let tabs: chrome.tabs.Tab[];
  let focusedTabs: chrome.tabs.Tab[];

  const pending = () => firstValueFrom(pendingRequestService.pendingRequest$);

  const prepareRequest = (overrides: Record<string, unknown> = {}) => ({
    requestId: "r1",
    approvalId: "a1",
    userId: USER_ID,
    url: "https://www.delta.com/login",
    connectionName: "Claude Desktop",
    ...overrides,
  });

  const fillRequest = (overrides: Record<string, unknown> = {}) => ({
    requestId: "r2",
    approvalId: "a1",
    userId: USER_ID,
    tabId: 5,
    expectedDomain: "www.delta.com",
    cipherId: "cipher-1",
    cipherType: CipherType.Login,
    ...overrides,
  });

  const responses = () => sent.filter((m) => m.topic === AgentFillTopic.Response);
  const hellos = () => sent.filter((m) => m.topic === AgentFillTopic.Hello);

  function deliver(topic: string, payload: unknown, source: unknown = "DesktopMain") {
    messages$.next({ topic, source, parse_payload_as_json: () => payload });
  }

  async function settle() {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  }

  beforeEach(() => {
    messages$ = new Subject();
    sent = [];
    const ipcService = {
      messages$,
      send: jest.fn(async (m: any) => {
        sent.push(m);
      }),
    } as unknown as IpcService;

    cipher = new CipherView();
    cipher.id = "cipher-1";
    cipher.type = CipherType.Login;
    cipher.reprompt = CipherRepromptType.None;

    autofillService = mock<AutofillService>();
    autofillService.collectPageDetailsFromTab$.mockReturnValue(
      of([{ frameId: 0, tab: TAB, details: { fields: [{}] } as any }]),
    );
    autofillService.doAutoFill.mockResolvedValue({ didAutofill: true });

    cipherService = mock<CipherService>();
    cipherService.getAllDecryptedForIds.mockResolvedValue([cipher]);
    cipherService.filterCiphersForUrl.mockResolvedValue([cipher]);

    const accountService = mock<AccountService>();
    activeAccount$ = new BehaviorSubject<{ id: string } | null>({ id: USER_ID });
    (accountService as any).activeAccount$ = activeAccount$;
    (accountService as any).accounts$ = new BehaviorSubject({
      [USER_ID]: { email: "a@example.com" },
      [OTHER_USER_ID]: { email: "b@example.com" },
    });

    allowed = {
      [USER_ID]: new BehaviorSubject(true),
      [OTHER_USER_ID]: new BehaviorSubject(false),
    };
    const agentFillSettingsService = mock<AgentFillSettingsService>();
    agentFillSettingsService.agentFillAllowed$.mockImplementation((userId) => allowed[userId]);
    desktopConnected$ = new Subject<void>();
    authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.isSafari.mockReturnValue(false);
    platformUtilsService.getDeviceString.mockReturnValue("chrome");
    platformUtilsService.getApplicationVersion.mockResolvedValue("2026.10.0");

    tabs = [TAB];
    focusedTabs = [TAB];
    jest
      .spyOn(BrowserApi, "tabsQuery")
      .mockImplementation(async (query) => (query?.active ? focusedTabs : tabs));
    jest.spyOn(BrowserApi, "getTab").mockResolvedValue(TAB);

    pendingRequestService = new AgentFillPendingRequestService(
      new FakeStateProvider(mockAccountServiceWith(USER_ID as UserId)),
    );
    flagEnabled$ = new BehaviorSubject(true);
    const configService = mock<ConfigService>();
    configService.getFeatureFlag$.mockImplementation((flag) =>
      flag === FeatureFlag.AgentFill ? flagEnabled$ : of(false),
    );
    configService.getFeatureFlag.mockImplementation(
      async (flag) => flag === FeatureFlag.AgentFill && flagEnabled$.value,
    );

    new AgentFillBackground(
      ipcService,
      autofillService,
      cipherService,
      accountService,
      authService,
      platformUtilsService,
      mock<LogService>(),
      agentFillSettingsService,
      pendingRequestService,
      configService,
      desktopConnected$,
    ).init();
  });

  afterEach(() => jest.restoreAllMocks());

  it("ignores requests that do not come from the desktop app", async () => {
    deliver(AgentFillTopic.PrepareFill, prepareRequest(), {
      Web: { tab_id: 1, document_id: "d", origin: "https://evil.example" },
    });
    await settle();
    expect(responses()).toHaveLength(0);
  });

  describe("prepare", () => {
    it("finds the tab for the URL's origin and reports its real domain", async () => {
      deliver(AgentFillTopic.PrepareFill, prepareRequest({ url: "https://www.delta.com/other" }));
      await settle();

      expect(responses()[0]).toMatchObject({
        topic: AgentFillTopic.Response,
        destination: "DesktopMain",
        payload: {
          requestId: "r1",
          ok: true,
          tabId: 5,
          domain: "www.delta.com",
          tabUrl: TAB.url,
          browser: "chrome",
          unlocked: true,
        },
      });
    });

    it("shows the request as pending in the popup", async () => {
      deliver(AgentFillTopic.PrepareFill, prepareRequest());
      await settle();

      expect(await pending()).toEqual({
        approvalId: "a1",
        domain: "www.delta.com",
        connectionName: "Claude Desktop",
      });
    });

    it("does not show a request as pending while the extension is locked", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

      deliver(AgentFillTopic.PrepareFill, prepareRequest());
      await settle();

      expect(responses()[0].payload).toMatchObject({ ok: true, unlocked: false });
      expect(await pending()).toBeNull();
    });

    it("answers no_open_tab when no tab is on the origin and the front page is not a website", async () => {
      tabs = [];
      focusedTabs = [{ id: 9, url: "chrome://extensions", windowId: 1 } as chrome.tabs.Tab];

      deliver(AgentFillTopic.PrepareFill, prepareRequest({ url: "https://united.com/" }));
      await settle();

      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_open_tab" });
      expect(await pending()).toBeNull();
    });

    it("answers no_open_tab when no tab is on the origin and nothing is in front", async () => {
      tabs = [];
      focusedTabs = [];

      deliver(AgentFillTopic.PrepareFill, prepareRequest({ url: "https://united.com/" }));
      await settle();

      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_open_tab" });
    });

    it("answers wrong_site when no tab is on the origin but the front page is on another site", async () => {
      tabs = [TAB, OTHER_TAB];
      focusedTabs = [OTHER_TAB];

      deliver(AgentFillTopic.PrepareFill, prepareRequest({ url: "https://shop.example.com/" }));
      await settle();

      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "wrong_site" });
      expect(await pending()).toBeNull();
    });

    it("takes the active tab of the focused window when several tabs match", async () => {
      const second = { id: 7, url: "https://www.delta.com/trips", windowId: 2 } as chrome.tabs.Tab;
      tabs = [TAB, second];
      focusedTabs = [second];

      deliver(AgentFillTopic.PrepareFill, prepareRequest());
      await settle();

      expect(responses()[0].payload).toMatchObject({
        ok: true,
        tabId: 7,
        tabUrl: "https://www.delta.com/trips",
      });
    });

    it("answers no_open_tab when several tabs match and none is in front", async () => {
      const second = { id: 7, url: "https://www.delta.com/trips", windowId: 2 } as chrome.tabs.Tab;
      tabs = [TAB, second, OTHER_TAB];
      focusedTabs = [OTHER_TAB];

      deliver(AgentFillTopic.PrepareFill, prepareRequest());
      await settle();

      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_open_tab" });
    });

    it("answers no_open_tab for a URL that is not http(s)", async () => {
      deliver(AgentFillTopic.PrepareFill, prepareRequest({ url: "javascript:alert(1)" }));
      await settle();

      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_open_tab" });
    });
  });

  describe("fill", () => {
    const fill = async (request = fillRequest()) => {
      deliver(AgentFillTopic.FillItem, request);
      await new Promise((r) => setTimeout(r, 400));
    };

    beforeEach(async () => {
      await pendingRequestService.setPending({
        approvalId: "a1",
        domain: "www.delta.com",
        connectionName: "Claude Desktop",
      });
    });

    it("fills an approved login whose URIs match the tab and clears the pending request", async () => {
      await fill();

      expect(cipherService.filterCiphersForUrl).toHaveBeenCalledWith([cipher], TAB.url);
      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({ tab: TAB, cipher, allowTotpAutofill: true }),
      );
      expect(responses()[0].payload).toEqual({ requestId: "r2", ok: true });
      expect(await pending()).toBeNull();
    });

    it("fills an approved card on the approved domain without checking saved URIs", async () => {
      cipher.type = CipherType.Card;

      await fill(fillRequest({ cipherType: CipherType.Card }));

      expect(cipherService.filterCiphersForUrl).not.toHaveBeenCalled();
      expect(autofillService.doAutoFill).toHaveBeenCalledWith(
        expect.objectContaining({ tab: TAB, cipher }),
      );
      expect(responses()[0].payload).toEqual({ requestId: "r2", ok: true });
    });

    it("answers wrong_site for a login whose saved URIs do not match the tab", async () => {
      cipherService.filterCiphersForUrl.mockResolvedValue([]);

      await fill();

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "wrong_site" });
      expect(await pending()).toBeNull();
    });

    it("answers wrong_site when the tab left the approved domain, for a login", async () => {
      await fill(fillRequest({ expectedDomain: "united.com" }));

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "wrong_site" });
    });

    it("answers wrong_site when the tab left the approved domain, for a card", async () => {
      cipher.type = CipherType.Card;

      await fill(fillRequest({ expectedDomain: "united.com", cipherType: CipherType.Card }));

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "wrong_site" });
    });

    it("answers wrong_site when the tab was closed", async () => {
      jest.spyOn(BrowserApi, "getTab").mockRejectedValue(new Error("No tab with id: 5"));

      await fill();

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "wrong_site" });
    });

    it("answers no_matching_item when the item is not in the vault", async () => {
      cipherService.getAllDecryptedForIds.mockResolvedValue([]);

      await fill();

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_matching_item" });
    });

    it("answers no_matching_item when the item is a different type than approved", async () => {
      await fill(fillRequest({ cipherType: CipherType.Card }));

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_matching_item" });
    });

    it("does not fill an item that needs a master password re-prompt", async () => {
      cipher.reprompt = CipherRepromptType.Password;

      await fill();

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_matching_item" });
    });

    it("answers form_not_found when no page details come back", async () => {
      autofillService.collectPageDetailsFromTab$.mockReturnValue(of([]));

      await fill();

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "form_not_found" });
    });

    it("answers form_not_found when autofill finds nothing to fill", async () => {
      autofillService.doAutoFill.mockResolvedValue({ didAutofill: false } as any);

      await fill();

      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "form_not_found" });
      expect(await pending()).toBeNull();
    });

    it("answers locked when the extension is locked", async () => {
      authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Locked));

      await fill();

      expect(autofillService.doAutoFill).not.toHaveBeenCalled();
      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "locked" });
    });

    it("never puts a credential in a response", async () => {
      await fill();

      expect(JSON.stringify(sent)).not.toMatch(/password|totp|number|code/i);
    });
  });

  describe("request closed", () => {
    beforeEach(async () => {
      await pendingRequestService.setPending({
        approvalId: "a1",
        domain: "www.delta.com",
        connectionName: "Claude Desktop",
      });
    });

    it("clears the popup banner when the approval ended without a fill", async () => {
      deliver(AgentFillTopic.RequestClosed, { approvalId: "a1" });
      await settle();

      expect(await pending()).toBeNull();
      expect(responses()).toHaveLength(0);
    });

    it("keeps the banner for a different request", async () => {
      deliver(AgentFillTopic.RequestClosed, { approvalId: "other" });
      await settle();

      expect(await pending()).toMatchObject({ approvalId: "a1" });
    });

    it("ignores a close that does not come from the desktop app", async () => {
      deliver(
        AgentFillTopic.RequestClosed,
        { approvalId: "a1" },
        { Web: { tab_id: 1, document_id: "d", origin: "https://evil.example" } },
      );
      await settle();

      expect(await pending()).toMatchObject({ approvalId: "a1" });
    });

    it("survives a malformed close message", async () => {
      messages$.next({
        topic: AgentFillTopic.RequestClosed,
        source: "DesktopMain",
        parse_payload_as_json: () => {
          throw new Error("bad");
        },
      });
      await settle();

      expect(await pending()).toMatchObject({ approvalId: "a1" });
    });
  });

  describe("feature flag", () => {
    it("answers error to requests and does not touch tabs while the flag is off", async () => {
      flagEnabled$.next(false);

      deliver(AgentFillTopic.PrepareFill, prepareRequest());
      await settle();

      expect(BrowserApi.tabsQuery).not.toHaveBeenCalled();
      expect(responses()[0].payload).toMatchObject({ ok: false, reason: "error" });
      expect(await pending()).toBeNull();
    });

    it("does not announce this browser while the flag is off, and does once it turns on", async () => {
      flagEnabled$.next(false);
      desktopConnected$.next();
      await settle();
      expect(hellos()).toHaveLength(0);

      flagEnabled$.next(true);
      await settle();
      expect(hellos()).toHaveLength(1);
    });
  });

  it("sends Hello on connect with each account's setting, and again when the setting changes", async () => {
    expect(hellos()).toHaveLength(0);

    desktopConnected$.next();
    await settle();
    expect(hellos()).toHaveLength(1);
    expect(hellos()[0]).toEqual({
      topic: AgentFillTopic.Hello,
      destination: "DesktopMain",
      payload: {
        browser: "chrome",
        extensionVersion: "2026.10.0",
        activeUserId: USER_ID,
        accounts: [
          { userId: USER_ID, agentFillAllowed: true },
          { userId: OTHER_USER_ID, agentFillAllowed: false },
        ],
      },
    });

    allowed[OTHER_USER_ID].next(true);
    await settle();
    expect(hellos()).toHaveLength(2);
    expect(hellos()[1].payload.accounts[1]).toEqual({
      userId: OTHER_USER_ID,
      agentFillAllowed: true,
    });

    activeAccount$.next({ id: OTHER_USER_ID });
    await settle();
    expect(hellos()[2].payload.activeUserId).toBe(OTHER_USER_ID);

    // Reconnect re-sends the latest Hello.
    desktopConnected$.next();
    await settle();
    expect(hellos()).toHaveLength(4);
  });

  it("refuses requests while agent fills are off for the active account", async () => {
    allowed[USER_ID].next(false);
    deliver(AgentFillTopic.PrepareFill, prepareRequest({ requestId: "r5" }));
    await settle();
    expect(BrowserApi.tabsQuery).not.toHaveBeenCalled();
    expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_allowed_browser" });
  });

  it("refuses requests for an account that is not the extension's active account", async () => {
    allowed[OTHER_USER_ID].next(true);
    deliver(AgentFillTopic.FillItem, fillRequest({ requestId: "r6", userId: OTHER_USER_ID }));
    await settle();
    expect(autofillService.doAutoFill).not.toHaveBeenCalled();
    expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_allowed_browser" });
  });
});
