import { Subject } from "rxjs";

import {
  DesktopPamConnectivityService,
  PAM_OFFLINE_DEBOUNCE_MS,
  PAM_RECONNECT_PROBE_INTERVAL_MS,
  PamConnectivityWindow,
} from "./desktop-pam-connectivity.service";

/** A window whose `navigator.onLine` and events the test drives. */
class FakeWindow extends EventTarget implements PamConnectivityWindow {
  readonly navigator = { onLine: true };

  goOffline(): void {
    this.navigator.onLine = false;
    this.dispatchEvent(new Event("offline"));
  }

  goOnline(): void {
    this.navigator.onLine = true;
    this.dispatchEvent(new Event("online"));
  }
}

describe("DesktopPamConnectivityService", () => {
  let win: FakeWindow;
  let serverActivity$: Subject<unknown>;
  let syncCompleted$: Subject<{ successfully?: boolean }>;
  let service: DesktopPamConnectivityService;
  let offline: boolean[];
  let reconnects: number;

  function create(): void {
    service = new DesktopPamConnectivityService(win, serverActivity$, syncCompleted$);
    offline = [];
    reconnects = 0;
    service.offline$.subscribe((value) => offline.push(value));
    service.reconnected$.subscribe(() => reconnects++);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    win = new FakeWindow();
    serverActivity$ = new Subject();
    syncCompleted$ = new Subject();
    create();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts online when the browser reports a network", () => {
    expect(offline).toEqual([false]);
  });

  it("starts offline when the browser reports no network", () => {
    win.navigator.onLine = false;
    create();

    expect(offline).toEqual([true]);
  });

  describe("browser online and offline events", () => {
    it("goes offline once the offline event has held for the debounce", () => {
      win.goOffline();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS - 1);
      expect(offline).toEqual([false]);

      jest.advanceTimersByTime(1);
      expect(offline).toEqual([false, true]);
    });

    it("comes back online after the online event, announcing the reconnect once", () => {
      win.goOffline();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      win.goOnline();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      expect(offline).toEqual([false, true, false]);
      expect(reconnects).toBe(1);
    });

    it("ignores a blip shorter than the debounce", () => {
      win.goOffline();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS / 2);
      win.goOnline();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS * 2);

      expect(offline).toEqual([false]);
      expect(reconnects).toBe(0);
    });

    it("reports the undebounced state at once, for the call guard", () => {
      win.goOffline();

      expect(service.offlineNow).toBe(true);
      expect(service.browserOffline).toBe(true);
    });
  });

  describe("call outcomes", () => {
    it("goes offline when a call marks the server unreachable on a working network", () => {
      service.reportUnreachable();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      expect(offline).toEqual([false, true]);
      expect(service.browserOffline).toBe(false);
    });

    it("recovers when a later call reaches the server", () => {
      service.reportUnreachable();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      service.reportReachable();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      expect(offline).toEqual([false, true, false]);
      expect(reconnects).toBe(1);
    });

    it("stays offline when a call succeeds while the browser still has no network", () => {
      win.goOffline();
      service.reportReachable();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      expect(offline).toEqual([false, true]);
    });

    it("clears an unreachable server on the online event, so the next call decides afresh", () => {
      service.reportUnreachable();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      win.goOnline();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      expect(offline).toEqual([false, true, false]);
    });
  });

  describe("server notification activity", () => {
    it("clears an unreachable server when a push arrives", () => {
      service.reportUnreachable();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      serverActivity$.next({});
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      expect(offline).toEqual([false, true, false]);
      expect(reconnects).toBe(1);
    });

    it("clears an unreachable server on a successful sync, not on a failed one", () => {
      service.reportUnreachable();
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);

      syncCompleted$.next({ successfully: false });
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);
      expect(offline).toEqual([false, true]);

      syncCompleted$.next({ successfully: true });
      jest.advanceTimersByTime(PAM_OFFLINE_DEBOUNCE_MS);
      expect(offline).toEqual([false, true, false]);
    });
  });

  describe("reconnect probe", () => {
    it("probes on an interval only while the network works but the server is unreachable", async () => {
      const probe = jest.fn().mockResolvedValue(undefined);
      service.startProbing(probe);

      jest.advanceTimersByTime(PAM_RECONNECT_PROBE_INTERVAL_MS * 2);
      expect(probe).not.toHaveBeenCalled();

      service.reportUnreachable();
      jest.advanceTimersByTime(PAM_RECONNECT_PROBE_INTERVAL_MS);
      expect(probe).toHaveBeenCalledTimes(1);

      win.goOffline();
      jest.advanceTimersByTime(PAM_RECONNECT_PROBE_INTERVAL_MS * 2);
      expect(probe).toHaveBeenCalledTimes(1);
    });

    it("stops probing once the server answers", async () => {
      const probe = jest.fn().mockImplementation(async () => service.reportReachable());
      service.startProbing(probe);
      service.reportUnreachable();

      jest.advanceTimersByTime(PAM_RECONNECT_PROBE_INTERVAL_MS);
      await Promise.resolve();
      jest.advanceTimersByTime(PAM_RECONNECT_PROBE_INTERVAL_MS * 3);

      expect(probe).toHaveBeenCalledTimes(1);
    });

    it("survives a probe that fails", async () => {
      const probe = jest.fn().mockRejectedValue(new Error("still down"));
      service.startProbing(probe);
      service.reportUnreachable();

      jest.advanceTimersByTime(PAM_RECONNECT_PROBE_INTERVAL_MS);
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(PAM_RECONNECT_PROBE_INTERVAL_MS);

      expect(probe).toHaveBeenCalledTimes(2);
    });
  });
});
