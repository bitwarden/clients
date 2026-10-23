import { EventEmitter } from "events";

import { BrowserWindow, ipcMain, session } from "electron";
import { mock, MockProxy } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { WindowMain } from "../../window.main";

import { OnePasswordSsoMain, isSsoRedirect, withoutAppTokens } from "./onepassword-sso.main";

jest.mock("electron", () => ({
  BrowserWindow: jest.fn(),
  ipcMain: { handle: jest.fn() },
  session: { fromPartition: jest.fn() },
}));

class FakeWebContents extends EventEmitter {
  openHandler: ((details: { url: string }) => any) | undefined;

  setWindowOpenHandler(handler: (details: { url: string }) => any) {
    this.openHandler = handler;
  }
}

class FakeWindow extends EventEmitter {
  readonly webContents = new FakeWebContents();
  destroyed = false;
  /** Whether the page vetoes unloading, as an identity provider's page can. */
  pageVetoesUnload = false;
  loadURL = jest.fn().mockResolvedValue(undefined);
  destroy = jest.fn(() => {
    this.destroyed = true;
    this.emit("closed");
  });
  close = jest.fn(() => {
    if (!this.unloadVetoed()) {
      this.destroy();
    }
  });

  constructor(readonly options: any = {}) {
    super();
  }

  isDestroyed() {
    return this.destroyed;
  }

  /** Whether the page keeps the window open, which only a listener of the app can stop. */
  private unloadVetoed(): boolean {
    if (!this.pageVetoesUnload) {
      return false;
    }
    const event = { preventDefault: jest.fn() };
    this.webContents.emit("will-prevent-unload", event);
    return event.preventDefault.mock.calls.length === 0;
  }
}

describe("OnePasswordSsoMain", () => {
  const ssoLoginUrl = "https://acme.okta.com/oauth2/authorize?state=abc";
  const redirectTo = "https://acme.1password.com/sso/oidc/redirect/";
  const redirectedTo = `${redirectTo}#code=secret-code&state=abc`;

  let logService: MockProxy<LogService>;
  let mainWindow: FakeWindow;
  /** The renderer that asks for the logins. */
  let renderer: FakeWebContents;
  let windows: FakeWindow[];
  let loginSession: {
    getUserAgent: jest.Mock;
    setUserAgent: jest.Mock;
    setPermissionRequestHandler: jest.Mock;
    setPermissionCheckHandler: jest.Mock;
    clearStorageData: jest.Mock;
    clearAuthCache: jest.Mock;
  };
  let handlers: Map<string, (...args: any[]) => any>;

  const login = (url = ssoLoginUrl, redirect = redirectTo) =>
    handlers.get("onePasswordSso.login")!({ sender: renderer }, url, redirect) as Promise<
      string | undefined
    >;
  const cancel = () => handlers.get("onePasswordSso.cancel")!({});
  const loginWindow = () => windows[windows.length - 1];
  const partitionOf = (window: FakeWindow): string => window.options.webPreferences.partition;

  /** Emits a navigation event the way electron does, and reports whether it was left alone. */
  function navigate(
    window: FakeWindow,
    event: "will-redirect" | "will-navigate" | "will-frame-navigate",
    url: string,
    isMainFrame = true,
  ): { prevented: boolean } {
    const details = { url, isMainFrame, preventDefault: jest.fn() };
    window.webContents.emit(event, details);
    return { prevented: details.preventDefault.mock.calls.length > 0 };
  }

  /** Lets the pending promise chains run. */
  const flush = () => new Promise((resolve) => setTimeout(resolve));

  /** Whether `promise` has settled, without waiting for it to. */
  async function settled(promise: Promise<unknown>): Promise<boolean> {
    let done = false;
    void promise.then(() => (done = true));
    await flush();
    return done;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    logService = mock<LogService>();
    mainWindow = new FakeWindow();
    renderer = mainWindow.webContents;
    windows = [];
    loginSession = {
      getUserAgent: jest
        .fn()
        .mockReturnValue(
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Bitwarden/2025.1.0 Chrome/140.0.0.0 Electron/43.5.0 Safari/537.36",
        ),
      setUserAgent: jest.fn(),
      setPermissionRequestHandler: jest.fn(),
      setPermissionCheckHandler: jest.fn(),
      clearStorageData: jest.fn().mockResolvedValue(undefined),
      clearAuthCache: jest.fn().mockResolvedValue(undefined),
    };
    (session.fromPartition as jest.Mock).mockReturnValue(loginSession);
    (BrowserWindow as unknown as jest.Mock).mockImplementation((options) => {
      const window = new FakeWindow(options);
      windows.push(window);
      return window;
    });

    const windowMain = mock<WindowMain>();
    windowMain.win = mainWindow as unknown as BrowserWindow;
    new OnePasswordSsoMain(logService, windowMain);

    handlers = new Map(
      (ipcMain.handle as jest.Mock).mock.calls.map(([channel, handler]) => [channel, handler]),
    );
  });

  it("answers the login and cancel channels", () => {
    expect([...handlers.keys()].sort()).toEqual(["onePasswordSso.cancel", "onePasswordSso.login"]);
  });

  describe("opening the window", () => {
    it("loads the login page in a sandboxed window of the app", () => {
      void login();

      expect(windows).toHaveLength(1);
      expect(loginWindow().options).toEqual(
        expect.objectContaining({
          parent: mainWindow,
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            partition: expect.stringMatching(/^onepassword-sso-.+/),
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
          },
        }),
      );
      expect(loginWindow().loadURL).toHaveBeenCalledWith(ssoLoginUrl);
    });

    it("uses a session that does not give the app away and refuses permissions", () => {
      void login();

      expect(session.fromPartition).toHaveBeenCalledWith(partitionOf(loginWindow()));
      expect(loginSession.setUserAgent).toHaveBeenCalledWith(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      );
      const callback = jest.fn();
      loginSession.setPermissionRequestHandler.mock.calls[0][0]({}, "geolocation", callback);
      expect(callback).toHaveBeenCalledWith(false);
      expect(
        loginSession.setPermissionCheckHandler.mock.calls[0][0]({}, "media", ssoLoginUrl, {}),
      ).toBe(false);
    });

    it.each(["http://acme.okta.com/login", "file:///etc/passwd", "not a url", ""])(
      "refuses to sign in at %j",
      async (url) => {
        await expect(login(url)).rejects.toThrow();

        expect(windows).toHaveLength(0);
      },
    );

    it("refuses a redirect address that is not an address", async () => {
      await expect(login(ssoLoginUrl, "not a url")).rejects.toThrow();

      expect(windows).toHaveLength(0);
    });

    it("keeps the session in memory", () => {
      void login();

      expect(partitionOf(loginWindow())).not.toContain("persist:");
    });

    it("gives every login a session of its own", async () => {
      const first = login();
      await cancel();
      await first;
      void login();

      expect(partitionOf(windows[0])).not.toBe(partitionOf(windows[1]));
      expect((session.fromPartition as jest.Mock).mock.calls.map(([name]) => name)).toEqual([
        partitionOf(windows[0]),
        partitionOf(windows[1]),
      ]);
    });

    it("replaces a login that is still going on", async () => {
      const first = login();
      const second = login();

      await expect(first).resolves.toBeUndefined();
      expect(windows[0].destroy).toHaveBeenCalled();
      expect(windows).toHaveLength(2);
      expect(await settled(second)).toBe(false);
    });
  });

  describe("capturing the redirect", () => {
    it.each(["will-redirect", "will-navigate", "will-frame-navigate"] as const)(
      "stops the navigation to the redirect on %s and resolves with its address",
      async (event) => {
        const result = login();

        const { prevented } = navigate(loginWindow(), event, redirectedTo);

        expect(prevented).toBe(true);
        await expect(result).resolves.toBe(redirectedTo);
        expect(loginWindow().destroy).toHaveBeenCalled();
        expect(loginSession.clearStorageData).toHaveBeenCalled();
        expect(loginSession.clearAuthCache).toHaveBeenCalled();
        expect(logService.info).toHaveBeenCalledWith(`1Password SSO redirect captured on ${event}`);
      },
    );

    it.each(["did-navigate", "did-navigate-in-page"] as const)(
      "resolves with the address the window ended up on after %s",
      async (event) => {
        const result = login();

        loginWindow().webContents.emit(event, {}, redirectedTo, true);

        await expect(result).resolves.toBe(redirectedTo);
        expect(loginWindow().destroy).toHaveBeenCalled();
      },
    );

    it("tolerates a redirect without the trailing slash", async () => {
      const result = login();
      const address = "https://acme.1password.com/sso/oidc/redirect#code=secret-code&state=abc";

      navigate(loginWindow(), "will-redirect", address);

      await expect(result).resolves.toBe(address);
    });

    it("recognizes a redirect that carries the code in the query", async () => {
      const result = login();
      const address = `${redirectTo}?code=secret-code&state=abc`;

      navigate(loginWindow(), "will-navigate", address);

      await expect(result).resolves.toBe(address);
    });

    it("stops a redirect to the 1Password app so that the system does not open it", async () => {
      const result = login(ssoLoginUrl, "onepassword://sso/oidc/redirect");
      const address = "onepassword://sso/oidc/redirect?code=secret-code&state=abc";

      const { prevented } = navigate(loginWindow(), "will-redirect", address);

      expect(prevented).toBe(true);
      await expect(result).resolves.toBe(address);
      expect(loginWindow().destroy).toHaveBeenCalled();
    });

    it.each([
      "https://acme.okta.com/login/step-up",
      "https://evil.example.com/sso/oidc/redirect/#code=x",
      "https://acme.1password.com/sso/oidc/other/#code=x",
      "about:blank",
    ])("leaves the navigation to %j alone", async (url) => {
      const result = login();

      const { prevented } = navigate(loginWindow(), "will-navigate", url);

      expect(prevented).toBe(false);
      expect(await settled(result)).toBe(false);
      expect(loginWindow().destroy).not.toHaveBeenCalled();
    });

    it.each(
      (["will-redirect", "will-navigate", "will-frame-navigate"] as const).flatMap((event) =>
        [
          "http://acme.okta.com/login",
          "file:///etc/passwd",
          "onepassword://sso/oidc/redirect?code=x",
          "not a url",
        ].map((url) => [event, url] as const),
      ),
    )("keeps the window on https on %s to %j", async (event, url) => {
      const result = login();

      const { prevented } = navigate(loginWindow(), event, url);

      expect(prevented).toBe(true);
      expect(await settled(result)).toBe(false);
    });

    it.each(["will-redirect", "will-frame-navigate"] as const)(
      "ignores a frame that is not the main frame on %s",
      async (event) => {
        const result = login();

        const { prevented } = navigate(loginWindow(), event, redirectedTo, false);

        expect(prevented).toBe(false);
        expect(await settled(result)).toBe(false);
      },
    );

    it("ignores an in-page navigation of a frame that is not the main frame", async () => {
      const result = login();

      loginWindow().webContents.emit("did-navigate-in-page", {}, redirectedTo, false);

      expect(await settled(result)).toBe(false);
    });

    it("settles once, whichever event comes first", async () => {
      const result = login();

      navigate(loginWindow(), "will-navigate", redirectedTo);
      navigate(loginWindow(), "will-frame-navigate", `${redirectTo}#code=other`);

      await expect(result).resolves.toBe(redirectedTo);
      expect(logService.info).toHaveBeenCalledTimes(1);
    });

    it("never logs an address", async () => {
      const result = login();
      navigate(loginWindow(), "will-redirect", redirectedTo);
      await result;

      const logged = JSON.stringify(
        [logService.debug, logService.info, logService.warning, logService.error].map(
          (log) => log.mock.calls,
        ),
      );
      expect(logged).not.toContain("secret-code");
      expect(logged).not.toContain("1password.com");
    });
  });

  describe("ending without a redirect", () => {
    it("resolves with nothing when the user closes the window", async () => {
      const result = login();

      loginWindow().emit("closed");

      await expect(result).resolves.toBeUndefined();
      expect(loginSession.clearStorageData).toHaveBeenCalled();
      expect(loginSession.clearAuthCache).toHaveBeenCalled();
    });

    it("destroys the window and resolves with nothing when the renderer cancels", async () => {
      const result = login();

      await cancel();

      await expect(result).resolves.toBeUndefined();
      expect(loginWindow().destroy).toHaveBeenCalled();
    });

    it("lets the user close a window whose page vetoes unloading", async () => {
      const result = login();
      loginWindow().pageVetoesUnload = true;

      loginWindow().close();

      await expect(result).resolves.toBeUndefined();
      expect(loginWindow().isDestroyed()).toBe(true);
      expect(loginSession.clearStorageData).toHaveBeenCalledTimes(1);
      expect(loginSession.clearAuthCache).toHaveBeenCalledTimes(1);
    });

    it("destroys a window whose page vetoes unloading when the renderer cancels", async () => {
      const result = login();
      loginWindow().pageVetoesUnload = true;

      await cancel();

      await expect(result).resolves.toBeUndefined();
      expect(loginWindow().isDestroyed()).toBe(true);
      expect(loginWindow().destroy).toHaveBeenCalledTimes(1);
      expect(loginSession.clearStorageData).toHaveBeenCalledTimes(1);
    });

    it("destroys a window whose page vetoes unloading once the redirect is captured", async () => {
      const result = login();
      loginWindow().pageVetoesUnload = true;

      navigate(loginWindow(), "will-redirect", redirectedTo);

      await expect(result).resolves.toBe(redirectedTo);
      expect(loginWindow().isDestroyed()).toBe(true);
    });

    it("does not destroy a window that is gone already", async () => {
      const result = login();
      loginWindow().destroyed = true;

      await cancel();

      await expect(result).resolves.toBeUndefined();
      expect(loginWindow().destroy).not.toHaveBeenCalled();
    });

    it("carries on when the session cannot be cleared", async () => {
      loginSession.clearAuthCache.mockRejectedValue(new Error("session is gone"));
      const result = login();

      await cancel();

      await expect(result).resolves.toBeUndefined();
      await flush();
      expect(logService.debug).toHaveBeenCalledWith("1Password SSO session could not be cleared");
    });

    it("cancels nothing when no login is going on", async () => {
      expect(() => cancel()).not.toThrow();
    });

    it("takes a new login after one ended", async () => {
      const first = login();
      navigate(loginWindow(), "will-redirect", redirectedTo);
      await first;

      const second = login();
      navigate(loginWindow(), "will-redirect", `${redirectTo}#code=again`);

      await expect(second).resolves.toBe(`${redirectTo}#code=again`);
      expect(windows).toHaveLength(2);
    });

    it("gives up when the renderer that asked reloads, as it does when the vault locks", async () => {
      const result = login();

      renderer.emit("did-start-navigation", { isMainFrame: true, isSameDocument: false });

      await expect(result).resolves.toBeUndefined();
      expect(loginWindow().destroy).toHaveBeenCalled();
      expect(loginSession.clearStorageData).toHaveBeenCalled();
    });

    it.each([
      ["moves within the page", { isMainFrame: true, isSameDocument: true }],
      ["navigates a frame", { isMainFrame: false, isSameDocument: false }],
    ])("carries on when the renderer that asked %s", async (_, navigation) => {
      const result = login();

      renderer.emit("did-start-navigation", navigation);

      expect(await settled(result)).toBe(false);
      expect(loginWindow().destroy).not.toHaveBeenCalled();
    });

    it.each(["render-process-gone", "destroyed"])(
      "gives up when the renderer that asked is gone on %s",
      async (event) => {
        const result = login();

        renderer.emit(event);

        await expect(result).resolves.toBeUndefined();
        expect(loginWindow().destroy).toHaveBeenCalled();
      },
    );

    it("stops watching the renderer that asked once the login ends", async () => {
      const result = login();
      navigate(loginWindow(), "will-redirect", redirectedTo);
      await result;

      for (const event of ["did-start-navigation", "render-process-gone", "destroyed"]) {
        expect(renderer.listenerCount(event)).toBe(0);
      }
    });

    it("carries on when the login page stops loading", async () => {
      (BrowserWindow as unknown as jest.Mock).mockImplementationOnce((options) => {
        const window = new FakeWindow(options);
        window.loadURL.mockRejectedValue(new Error("ERR_ABORTED loading a page"));
        windows.push(window);
        return window;
      });
      const result = login();

      await flush();

      expect(logService.debug).toHaveBeenCalledWith("1Password SSO login page stopped loading");
      expect(await settled(result)).toBe(false);
      navigate(loginWindow(), "will-redirect", redirectedTo);
      await expect(result).resolves.toBe(redirectedTo);
    });
  });

  describe("popups", () => {
    function open(url: string) {
      void login();
      return loginWindow().webContents.openHandler!({ url });
    }

    it("lets the identity provider open https popups as children in the same session", () => {
      const response = open("https://acme.okta.com/popup");

      expect(response).toEqual({
        action: "allow",
        overrideBrowserWindowOptions: {
          parent: loginWindow(),
          webPreferences: loginWindow().options.webPreferences,
        },
      });
      expect(loginWindow().options.webPreferences).toEqual({
        partition: expect.stringMatching(/^onepassword-sso-.+/),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      });
    });

    it("ignores the veto of a page to unloading, in the window and in its popups", () => {
      void login();
      const popup = new FakeWindow();
      loginWindow().webContents.emit("did-create-window", popup);

      for (const window of [loginWindow(), popup]) {
        const event = { preventDefault: jest.fn() };
        window.webContents.emit("will-prevent-unload", event);
        expect(event.preventDefault).toHaveBeenCalled();
      }
    });

    it("lets a popup start blank", () => {
      expect(open("about:blank").action).toBe("allow");
    });

    it.each([
      "http://acme.okta.com/popup",
      "file:///etc/passwd",
      "onepassword://sso/callback#code=x",
      "javascript:alert(1)",
      "not a url",
    ])("denies a popup to %j", (url) => {
      expect(open(url)).toEqual({ action: "deny" });
    });

    it("captures a redirect the popup ends up on", async () => {
      const result = login();
      const popup = new FakeWindow();

      loginWindow().webContents.emit("did-create-window", popup);
      const { prevented } = navigate(popup, "will-redirect", redirectedTo);

      expect(prevented).toBe(true);
      await expect(result).resolves.toBe(redirectedTo);
      expect(loginWindow().destroy).toHaveBeenCalled();
    });

    it.each([
      "onepassword://sso/oidc/redirect?code=secret-code&state=abc",
      "https://acme.1password.com/sso/oidc/redirect/?code=secret-code&state=abc",
    ])("captures the redirect %j when the page opens it as a window", async (address) => {
      const result = login(ssoLoginUrl, address.split("?")[0]);

      const response = loginWindow().webContents.openHandler!({ url: address });

      expect(response).toEqual({ action: "deny" });
      await expect(result).resolves.toBe(address);
      expect(loginWindow().destroy).toHaveBeenCalled();
      expect(logService.info).toHaveBeenCalledWith(
        "1Password SSO redirect captured on window-open",
      );
    });

    it("captures a redirect a popup opens as a window", async () => {
      const result = login();
      const popup = new FakeWindow();
      loginWindow().webContents.emit("did-create-window", popup);

      const response = popup.webContents.openHandler!({ url: redirectedTo });

      expect(response).toEqual({ action: "deny" });
      await expect(result).resolves.toBe(redirectedTo);
    });

    it("keeps a popup on https", async () => {
      const result = login();
      const popup = new FakeWindow();
      loginWindow().webContents.emit("did-create-window", popup);

      const { prevented } = navigate(popup, "will-frame-navigate", "http://acme.okta.com/popup");

      expect(prevented).toBe(true);
      expect(await settled(result)).toBe(false);
    });

    it("does not end the login when only a popup closes", async () => {
      const result = login();
      const popup = new FakeWindow();
      loginWindow().webContents.emit("did-create-window", popup);

      popup.emit("closed");

      expect(await settled(result)).toBe(false);
    });
  });
});

describe("isSsoRedirect", () => {
  describe("for a page of 1Password", () => {
    const redirectTo = new URL("https://acme.1password.com/sso/oidc/redirect/");

    it.each([
      "https://acme.1password.com/sso/oidc/redirect/#code=a&state=b",
      "https://acme.1password.com/sso/oidc/redirect#code=a&state=b",
      "https://acme.1password.com/sso/oidc/redirect/?code=a&state=b",
      "https://acme.1password.com/sso/oidc/redirect/?error=access_denied",
    ])("accepts %j", (address) => {
      expect(isSsoRedirect(address, redirectTo)).toBe(true);
    });

    it.each([
      "http://acme.1password.com/sso/oidc/redirect/#code=a",
      "onepassword://acme.1password.com/sso/oidc/redirect/?code=a",
      "https://other.1password.com/sso/oidc/redirect/#code=a",
      "https://acme.1password.com:8443/sso/oidc/redirect/#code=a",
      "https://acme.1password.com/sso/oidc/redirect/more#code=a",
      "https://acme.1password.com/sso/oidc/redirect-evil#code=a",
      "https://acme.1password.com/sso/oidc/#code=a",
      "about:blank",
      "",
    ])("refuses %j", (address) => {
      expect(isSsoRedirect(address, redirectTo)).toBe(false);
    });
  });

  describe("for the 1Password app", () => {
    const redirectTo = new URL("onepassword://sso/oidc/redirect");

    it.each([
      "onepassword://sso/oidc/redirect?code=c&state=s",
      "onepassword://sso/oidc/redirect/?code=c&state=s",
      "onepassword://sso/oidc/redirect#code=c&state=s",
      "onepassword://sso/oidc/redirect",
    ])("accepts %j", (address) => {
      expect(isSsoRedirect(address, redirectTo)).toBe(true);
    });

    it.each([
      "https://sso/oidc/redirect?code=c&state=s",
      "otherscheme://sso/oidc/redirect?code=c&state=s",
      "onepassword://other/oidc/redirect?code=c&state=s",
      "onepassword://sso/oidc/redirect-evil?code=c&state=s",
      "onepassword://sso/oidc/redirect/more?code=c&state=s",
      "onepassword://sso/oidc?code=c&state=s",
      "onepassword://callback?code=a",
    ])("refuses %j", (address) => {
      expect(isSsoRedirect(address, redirectTo)).toBe(false);
    });
  });
});

describe("withoutAppTokens", () => {
  it("removes the app and electron tokens and keeps the rest", () => {
    expect(
      withoutAppTokens(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Bitwarden/2025.1.0 Chrome/140.0.0.0 Electron/43.5.0 Safari/537.36",
      ),
    ).toBe(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    );
  });

  it("removes the token of a build with a longer name", () => {
    expect(withoutAppTokens("Mozilla/5.0 Bitwarden-Beta/2025.1.0 Chrome/140.0.0.0")).toBe(
      "Mozilla/5.0 Chrome/140.0.0.0",
    );
  });
});
