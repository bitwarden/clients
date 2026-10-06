import { mock } from "jest-mock-extended";
import { BehaviorSubject, of, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AgentFillTopic } from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType, CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { BrowserApi } from "../../platform/browser/browser-api";
import { AutofillService } from "../services/abstractions/autofill.service";
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

describe("AgentFillBackground (prototype)", () => {
  let messages$: Subject<any>;
  let sent: Array<{ payload: any; destination: any; topic: string }>;
  let autofillService: jest.Mocked<AutofillService>;
  let cipherService: jest.Mocked<CipherService>;
  let cipher: CipherView;
  let desktopConnected$: Subject<void>;
  let allowed: Record<string, BehaviorSubject<boolean>>;
  let activeAccount$: BehaviorSubject<{ id: string } | null>;

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
    const authService = mock<AuthService>();
    authService.authStatusFor$.mockReturnValue(of(AuthenticationStatus.Unlocked));
    const platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.isSafari.mockReturnValue(false);
    platformUtilsService.getDeviceString.mockReturnValue("chrome");
    platformUtilsService.getApplicationVersion.mockResolvedValue("2026.10.0");

    jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([TAB]);
    jest.spyOn(BrowserApi, "getTab").mockResolvedValue(TAB);

    new AgentFillBackground(
      ipcService,
      autofillService,
      cipherService,
      accountService,
      authService,
      platformUtilsService,
      mock<LogService>(),
      agentFillSettingsService,
      desktopConnected$,
    ).init();
  });

  afterEach(() => jest.restoreAllMocks());

  it("ignores requests that do not come from the desktop app", async () => {
    deliver(
      AgentFillTopic.PrepareFill,
      { requestId: "r1", userId: USER_ID, url: "https://www.delta.com/" },
      {
        Web: { tab_id: 1, document_id: "d", origin: "https://evil.example" },
      },
    );
    await settle();
    expect(responses()).toHaveLength(0);
  });

  it("finds the tab for the URL's origin and reports its real domain", async () => {
    deliver(AgentFillTopic.PrepareFill, {
      requestId: "r1",
      userId: USER_ID,
      url: "https://www.delta.com/other",
    });
    await settle();
    expect(responses()[0]).toMatchObject({
      topic: AgentFillTopic.Response,
      destination: "DesktopMain",
      payload: {
        requestId: "r1",
        ok: true,
        tabId: 5,
        domain: "www.delta.com",
        browser: "chrome",
        unlocked: true,
      },
    });
  });

  it("fails PrepareFill when no tab is on the origin", async () => {
    deliver(AgentFillTopic.PrepareFill, {
      requestId: "r1",
      userId: USER_ID,
      url: "https://united.com/",
    });
    await settle();
    expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_open_tab" });
  });

  it("fills an approved login whose URIs match the tab", async () => {
    deliver(AgentFillTopic.FillItem, {
      requestId: "r2",
      userId: USER_ID,
      tabId: 5,
      expectedDomain: "www.delta.com",
      cipherId: "cipher-1",
      cipherType: CipherType.Login,
    });
    await new Promise((r) => setTimeout(r, 400));
    expect(cipherService.filterCiphersForUrl).toHaveBeenCalledWith([cipher], TAB.url);
    expect(autofillService.doAutoFill).toHaveBeenCalledWith(
      expect.objectContaining({ tab: TAB, cipher, allowTotpAutofill: true }),
    );
    expect(responses()[0].payload).toEqual({ requestId: "r2", ok: true });
  });

  it("refuses a login whose saved URIs do not match the tab", async () => {
    cipherService.filterCiphersForUrl.mockResolvedValue([]);
    deliver(AgentFillTopic.FillItem, {
      requestId: "r3",
      userId: USER_ID,
      tabId: 5,
      expectedDomain: "www.delta.com",
      cipherId: "cipher-1",
      cipherType: CipherType.Login,
    });
    await settle();
    expect(autofillService.doAutoFill).not.toHaveBeenCalled();
    expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_matching_item" });
  });

  it("refuses when the tab left the approved domain", async () => {
    deliver(AgentFillTopic.FillItem, {
      requestId: "r4",
      userId: USER_ID,
      tabId: 5,
      expectedDomain: "united.com",
      cipherId: "cipher-1",
      cipherType: CipherType.Login,
    });
    await settle();
    expect(autofillService.doAutoFill).not.toHaveBeenCalled();
    expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_open_tab" });
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
    deliver(AgentFillTopic.PrepareFill, {
      requestId: "r5",
      userId: USER_ID,
      url: "https://www.delta.com/",
    });
    await settle();
    expect(BrowserApi.tabsQuery).not.toHaveBeenCalled();
    expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_allowed_browser" });
  });

  it("refuses requests for an account that is not the extension's active account", async () => {
    allowed[OTHER_USER_ID].next(true);
    deliver(AgentFillTopic.FillItem, {
      requestId: "r6",
      userId: OTHER_USER_ID,
      tabId: 5,
      expectedDomain: "www.delta.com",
      cipherId: "cipher-1",
      cipherType: CipherType.Login,
    });
    await settle();
    expect(autofillService.doAutoFill).not.toHaveBeenCalled();
    expect(responses()[0].payload).toMatchObject({ ok: false, reason: "no_allowed_browser" });
  });
});
