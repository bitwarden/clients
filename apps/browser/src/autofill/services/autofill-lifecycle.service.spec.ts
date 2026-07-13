import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Subscription } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BrowserApi } from "../../platform/browser/browser-api";
import { AutofillerCommand, AutofillLifecycleCommand } from "../enums/autofill-message.enums";
import { AutofillPort } from "../enums/autofill-port.enum";
import { createChromeTabMock } from "../spec/autofill-mocks";
import { flushPromises } from "../spec/testing-utils";

import { PageTransitionResolved } from "./abstractions/autofill-lifecycle.service";
import { DefaultAutofillLifecycleService } from "./autofill-lifecycle.service";

describe("DefaultAutofillLifecycleService", () => {
  let service: DefaultAutofillLifecycleService;
  let authService: MockProxy<AuthService>;
  const logService = mock<LogService>();
  let activeAccountStatusMock$: BehaviorSubject<AuthenticationStatus>;
  let tabSendMessageSpy: jest.SpyInstance;

  const makePort = (frameId: number | undefined, name: string = AutofillPort.InjectedScript) => {
    const port = mock<chrome.runtime.Port>({ name, onDisconnect: { addListener: jest.fn() } });
    (port as any).sender = { tab: createChromeTabMock({ id: 1 }), frameId };
    return port;
  };

  // Drives the real chrome onConnect entry point so the suite exercises the
  // same wiring the browser does, rather than the internal port stream.
  const connectPort = (port: chrome.runtime.Port) =>
    service["handleInjectedScriptPortConnection"](port);

  const markMonitoring = (tabId: number, frameId: number | undefined, active: boolean) =>
    service["monitorLifecycle$"].next({ tabId, frameId, active });

  beforeEach(() => {
    activeAccountStatusMock$ = new BehaviorSubject(AuthenticationStatus.Unlocked);
    authService = mock<AuthService>();
    authService.activeAccountStatus$ = activeAccountStatusMock$;

    jest.spyOn(BrowserApi, "addListener").mockImplementation();
    tabSendMessageSpy = jest.spyOn(BrowserApi, "tabSendMessage").mockResolvedValue(undefined);

    service = new DefaultAutofillLifecycleService(authService, logService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe("init", () => {
    it("registers an extension runtime onConnect listener", () => {
      service.init();

      expect(BrowserApi.addListener).toHaveBeenCalledWith(
        chrome.runtime.onConnect,
        service["handleInjectedScriptPortConnection"],
      );
    });

    it("registers a tabs onRemoved listener", () => {
      service.init();

      expect(BrowserApi.addListener).toHaveBeenCalledWith(
        chrome.tabs.onRemoved,
        service["handleTabRemoved"],
      );
    });
  });

  describe("port registry", () => {
    beforeEach(() => service.init());

    it("ignores port connections that do not have the correct port name", () => {
      const port = makePort(0, "some-invalid-port-name");

      service["handleInjectedScriptPortConnection"](port);

      expect(port.onDisconnect.addListener).not.toHaveBeenCalled();
      expect(service["connectedPorts"].value.size).toBe(0);
    });

    it("registers a connecting port and wires its disconnect", () => {
      const port = makePort(0);

      service["handleInjectedScriptPortConnection"](port);

      expect(port.onDisconnect.addListener).toHaveBeenCalledWith(
        service["handleInjectScriptPortOnDisconnect"],
      );
      expect(service["connectedPorts"].value.size).toBe(1);
    });

    it("ignores port disconnections that do not have the correct port name", () => {
      service["handleInjectedScriptPortConnection"](makePort(0));

      service["handleInjectScriptPortOnDisconnect"](makePort(0, "some-invalid-port-name"));

      expect(service["connectedPorts"].value.size).toBe(1);
    });

    it("deregisters a disconnecting port", () => {
      const port = makePort(0);
      service["handleInjectedScriptPortConnection"](port);

      service["handleInjectScriptPortOnDisconnect"](port);

      expect(service["connectedPorts"].value.size).toBe(0);
    });
  });

  describe("auth status transitions", () => {
    beforeEach(async () => {
      service.init();
      connectPort(makePort(0));
      await flushPromises();
      // The first emission of the auth subscription pairs [undefined, Unlocked]
      // and does not broadcast. Clear any setup-side calls before the test.
      tabSendMessageSpy.mockClear();
    });

    // Only the LoggedOut boundary broadcasts: crossing into a logged-in state
    // starts monitors, crossing out stops them and disables the autofiller.
    // Lock/unlock and repeats are silent.
    it.each([
      { transition: "LoggedOut → Locked", from: "LoggedOut", to: "Locked", commands: ["start"] },
      {
        transition: "LoggedOut → Unlocked",
        from: "LoggedOut",
        to: "Unlocked",
        commands: ["start"],
      },
      {
        transition: "Unlocked → LoggedOut",
        from: "Unlocked",
        to: "LoggedOut",
        commands: ["stop", "disable"],
      },
      {
        transition: "Locked → LoggedOut",
        from: "Locked",
        to: "LoggedOut",
        commands: ["stop", "disable"],
      },
      { transition: "Unlocked → Locked", from: "Unlocked", to: "Locked", commands: [] },
      { transition: "Locked → Unlocked", from: "Locked", to: "Unlocked", commands: [] },
      {
        transition: "Unlocked → Unlocked (repeat)",
        from: "Unlocked",
        to: "Unlocked",
        commands: [],
      },
    ] as const)("$transition", ({ from, to, commands }) => {
      const command = {
        start: AutofillLifecycleCommand.start,
        stop: AutofillLifecycleCommand.stop,
        disable: AutofillerCommand.disable,
      };

      // Establish the "from" state, then clear so only the transition under test
      // is observed.
      activeAccountStatusMock$.next(AuthenticationStatus[from]);
      tabSendMessageSpy.mockClear();

      activeAccountStatusMock$.next(AuthenticationStatus[to]);

      expect(tabSendMessageSpy).toHaveBeenCalledTimes(commands.length);
      commands.forEach((name) =>
        expect(tabSendMessageSpy).toHaveBeenCalledWith(
          expect.objectContaining({ id: 1 }),
          { command: command[name] },
          { frameId: 0 },
        ),
      );
    });
  });

  describe("service-worker boot seed", () => {
    // The first auth emission is the seed, not a transition; a worker booting
    // into any auth state must be silent.
    const bootInto = (status: AuthenticationStatus) => {
      activeAccountStatusMock$ = new BehaviorSubject(status);
      authService.activeAccountStatus$ = activeAccountStatusMock$;
      service = new DefaultAutofillLifecycleService(authService, logService);
      service.init();
      connectPort(makePort(0));
    };

    it("does not broadcast when the service worker boots into LoggedOut", async () => {
      bootInto(AuthenticationStatus.LoggedOut);
      await flushPromises();

      expect(tabSendMessageSpy).not.toHaveBeenCalled();
    });

    it("does not broadcast when the service worker boots into Locked", async () => {
      bootInto(AuthenticationStatus.Locked);
      await flushPromises();

      expect(tabSendMessageSpy).not.toHaveBeenCalled();
    });
  });

  describe("startMonitoringFrame", () => {
    const tab = createChromeTabMock({ id: 1 });

    beforeEach(() => service.init());

    it("sends startAutofillMonitors when an account is unlocked", async () => {
      await service.startMonitoringFrame(tab, 1);

      expect(tabSendMessageSpy).toHaveBeenCalledWith(
        tab,
        { command: AutofillLifecycleCommand.start },
        { frameId: 1 },
      );
    });

    it("sends startAutofillMonitors when an account is locked", async () => {
      activeAccountStatusMock$.next(AuthenticationStatus.Locked);

      await service.startMonitoringFrame(tab, 1);

      expect(tabSendMessageSpy).toHaveBeenCalledWith(
        tab,
        { command: AutofillLifecycleCommand.start },
        { frameId: 1 },
      );
    });

    it("does not send startAutofillMonitors when the account is logged out", async () => {
      activeAccountStatusMock$.next(AuthenticationStatus.LoggedOut);

      await service.startMonitoringFrame(tab, 1);

      expect(tabSendMessageSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        { command: AutofillLifecycleCommand.start },
        expect.anything(),
      );
    });
  });

  describe("retireAllFrames", () => {
    beforeEach(() => service.init());

    it("disconnects every connected port and clears the registry", () => {
      const port1 = makePort(0);
      const port2 = makePort(1);
      connectPort(port1);
      connectPort(port2);

      service.retireAllFrames();

      expect(port1.disconnect).toHaveBeenCalled();
      expect(port2.disconnect).toHaveBeenCalled();
      expect(service["connectedPorts"].value.size).toBe(0);
    });
  });

  describe("tabRemoved$", () => {
    beforeEach(() => service.init());

    it("emits for the removed tab id and not for others", () => {
      const removedFirst: number[] = [];
      const removedSecond: number[] = [];
      const first = service.tabRemoved$(1).subscribe(() => removedFirst.push(1));
      const second = service.tabRemoved$(2).subscribe(() => removedSecond.push(2));

      // The onRemoved handler is registered via BrowserApi.addListener (mocked),
      // so drive it directly, as the browser event would.
      service["handleTabRemoved"](1);

      expect(removedFirst).toEqual([1]);
      expect(removedSecond).toEqual([]);

      first.unsubscribe();
      second.unsubscribe();
    });
  });

  describe("page transition buffering", () => {
    const url = "https://example.test/page";
    let tab: chrome.tabs.Tab;
    let resolved: PageTransitionResolved[];
    let subscription: Subscription;

    const addPort = (frameId: number | undefined) => {
      const port = makePort(frameId);
      connectPort(port);
      return port;
    };

    beforeEach(() => {
      service.init();
      tab = createChromeTabMock({ id: 1 });
      resolved = [];
      // A subscriber both observes the seam and keeps the shared buffer hot.
      subscription = service.pageTransitionResolved$.subscribe((opportunity) =>
        resolved.push(opportunity),
      );
    });

    afterEach(() => subscription?.unsubscribe());

    it("resolves an opportunity immediately when the frame is already monitoring", async () => {
      markMonitoring(1, 0, true);

      service.reportPageTransition(tab, 0, url);
      await flushPromises();

      expect(resolved).toEqual([{ tab, tabId: 1, frameId: 0, frameUrl: url }]);
    });

    it("buffers a transition until its frame starts monitoring, then resolves it", async () => {
      service.reportPageTransition(tab, 0, url);
      await flushPromises();
      expect(resolved).toEqual([]);

      markMonitoring(1, 0, true);
      await flushPromises();

      expect(resolved).toEqual([{ tab, tabId: 1, frameId: 0, frameUrl: url }]);
    });

    it("drops a buffered transition when its frame disconnects, and a later start does not resurrect it", async () => {
      const port = addPort(0);

      service.reportPageTransition(tab, 0, url);
      await flushPromises();
      expect(resolved).toEqual([]);

      service["handleInjectScriptPortOnDisconnect"](port);

      // A start arriving after the frame has disconnected does not resurrect it.
      markMonitoring(1, 0, true);
      await flushPromises();

      expect(resolved).toEqual([]);
    });

    it("resolves with no frameId when the transition omits the frame", async () => {
      markMonitoring(1, undefined, true);

      service.reportPageTransition(tab, undefined, url);
      await flushPromises();

      expect(resolved).toEqual([{ tab, tabId: 1, frameId: undefined, frameUrl: url }]);
    });

    it("resolves each (tab, frame) independently", async () => {
      const otherTab = createChromeTabMock({ id: 2 });
      service.reportPageTransition(tab, 0, url);
      service.reportPageTransition(otherTab, 0, url);
      await flushPromises();

      // Only the first frame begins monitoring.
      markMonitoring(1, 0, true);
      await flushPromises();

      expect(resolved).toEqual([{ tab, tabId: 1, frameId: 0, frameUrl: url }]);
    });

    it("ignores a reported transition without a tab id", async () => {
      const tabWithoutId = createChromeTabMock({ id: undefined });
      markMonitoring(1, 0, true);

      service.reportPageTransition(tabWithoutId, 0, url);
      await flushPromises();

      expect(resolved).toEqual([]);
    });

    it("ignores a reported transition without a url", async () => {
      markMonitoring(1, 0, true);

      service.reportPageTransition(tab, 0, undefined);
      await flushPromises();

      expect(resolved).toEqual([]);
    });

    it("retires a frame from monitoring once its last port disconnects", async () => {
      const port = addPort(0);
      markMonitoring(1, 0, true);

      service["handleInjectScriptPortOnDisconnect"](port);

      // The frame is no longer monitoring, so a fresh transition stays buffered.
      service.reportPageTransition(tab, 0, url);
      await flushPromises();
      expect(resolved).toEqual([]);
    });

    it("keeps a frame monitoring while another port for the same (tab, frame) remains", async () => {
      addPort(0);
      const siblingPort = addPort(0);
      markMonitoring(1, 0, true);

      service["handleInjectScriptPortOnDisconnect"](siblingPort);

      // A sibling port remains, so the frame stays monitoring and the transition resolves.
      service.reportPageTransition(tab, 0, url);
      await flushPromises();
      expect(resolved).toEqual([{ tab, tabId: 1, frameId: 0, frameUrl: url }]);
    });
  });
});
