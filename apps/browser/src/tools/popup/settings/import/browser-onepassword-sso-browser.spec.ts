import { BrowserApi } from "../../../../platform/browser/browser-api";

import { BrowserOnePasswordSsoBrowser, isSsoRedirect } from "./browser-onepassword-sso-browser";

describe("isSsoRedirect", () => {
  const redirectTo = new URL("onepassword://sso/oidc/redirect");

  it.each([
    "onepassword://sso/oidc/redirect?code=c&state=s",
    "onepassword://sso/oidc/redirect/?code=c&state=s",
    "onepassword://sso/oidc/redirect#code=c&state=s",
  ])("matches %s", (address) => {
    expect(isSsoRedirect(address, redirectTo)).toBe(true);
  });

  it.each([
    "https://sso/oidc/redirect?code=c",
    "onepassword://other/oidc/redirect?code=c",
    "onepassword://sso/oidc/elsewhere?code=c",
    "not a url",
  ])("does not match %s", (address) => {
    expect(isSsoRedirect(address, redirectTo)).toBe(false);
  });
});

describe("BrowserOnePasswordSsoBrowser", () => {
  const loginUrl = "https://idp.example.com/authorize?redirect_uri=onepassword%3A%2F%2Fsso";
  const redirectTo = "onepassword://sso/oidc/redirect";
  const redirectedTo = "onepassword://sso/oidc/redirect?code=c0de&state=st4te";
  const tabId = 7;

  let browser: BrowserOnePasswordSsoBrowser;
  let onRedirect: ((details: chrome.webRequest.OnBeforeRedirectDetails) => void) | undefined;
  let onUpdated: ((tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => void) | undefined;
  let onRemoved: ((tabId: number) => void) | undefined;

  const redirect = (url: string) =>
    onRedirect!({ redirectUrl: url } as chrome.webRequest.OnBeforeRedirectDetails);

  /** Starts a login and lets it get as far as watching the tab. */
  async function startLogin(): Promise<{ login: Promise<string | undefined> }> {
    const login = browser.login(loginUrl, redirectTo);
    await new Promise((resolve) => setTimeout(resolve));
    return { login };
  }

  beforeEach(() => {
    jest.spyOn(BrowserApi, "canObserveRedirects").mockReturnValue(true);
    jest.spyOn(BrowserApi, "createNewTab").mockResolvedValue({ id: tabId } as chrome.tabs.Tab);
    jest.spyOn(BrowserApi, "navigateTabToUrl").mockResolvedValue();
    jest.spyOn(BrowserApi, "closeTab").mockResolvedValue();
    jest
      .spyOn(BrowserApi, "addRedirectListener")
      .mockImplementation((callback) => (onRedirect = callback));
    jest.spyOn(BrowserApi, "removeRedirectListener").mockImplementation(() => undefined);
    jest.spyOn(BrowserApi, "addListener").mockImplementation((event, callback) => {
      if (event === chrome.tabs.onUpdated) {
        onUpdated = callback;
      } else if (event === chrome.tabs.onRemoved) {
        onRemoved = callback;
      }
    });
    jest.spyOn(BrowserApi, "removeListener").mockImplementation(() => undefined);
    browser = new BrowserOnePasswordSsoBrowser();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    onRedirect = onUpdated = onRemoved = undefined;
  });

  it("is supported only where the browser reports redirects", () => {
    jest.spyOn(BrowserApi, "canObserveRedirects").mockReturnValue(false);

    expect(new BrowserOnePasswordSsoBrowser().supported).toBe(false);
    expect(browser.supported).toBe(true);
  });

  it("refuses a sign-in address that is not https", async () => {
    await expect(browser.login("http://idp.example.com/authorize", redirectTo)).rejects.toThrow();
    expect(BrowserApi.createNewTab).not.toHaveBeenCalled();
  });

  it("watches the tab before sending it to the identity provider", async () => {
    await startLogin();

    expect(BrowserApi.createNewTab).toHaveBeenCalledWith("about:blank", true);
    expect(BrowserApi.addRedirectListener).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ tabId, types: ["main_frame"] }),
    );
    const watched = jest.mocked(BrowserApi.addRedirectListener).mock.invocationCallOrder[0];
    const navigated = jest.mocked(BrowserApi.navigateTabToUrl).mock.invocationCallOrder[0];
    expect(watched).toBeLessThan(navigated);
    expect(BrowserApi.navigateTabToUrl).toHaveBeenCalledWith(tabId, new URL(loginUrl));
  });

  it("resolves with the redirect, closes the tab and stops watching", async () => {
    const { login } = await startLogin();

    redirect("https://idp.example.com/next");
    redirect(redirectedTo);

    await expect(login).resolves.toBe(redirectedTo);
    expect(BrowserApi.closeTab).toHaveBeenCalledWith(tabId);
    expect(BrowserApi.removeRedirectListener).toHaveBeenCalledWith(onRedirect);
    expect(BrowserApi.removeListener).toHaveBeenCalledWith(chrome.tabs.onUpdated, onUpdated);
    expect(BrowserApi.removeListener).toHaveBeenCalledWith(chrome.tabs.onRemoved, onRemoved);
  });

  it("catches a redirect that shows up as the address of the tab", async () => {
    const { login } = await startLogin();

    onUpdated!(tabId + 1, { url: redirectedTo });
    onUpdated!(tabId, { url: redirectedTo });

    await expect(login).resolves.toBe(redirectedTo);
  });

  it("resolves with undefined when the user closes the tab", async () => {
    const { login } = await startLogin();

    onRemoved!(tabId + 1);
    onRemoved!(tabId);

    await expect(login).resolves.toBeUndefined();
    expect(BrowserApi.closeTab).not.toHaveBeenCalled();
  });

  it("resolves with undefined and closes the tab when canceled", async () => {
    const { login } = await startLogin();

    browser.cancel();

    await expect(login).resolves.toBeUndefined();
    expect(BrowserApi.closeTab).toHaveBeenCalledWith(tabId);
  });

  it("gives up on a login still waiting when another starts", async () => {
    const { login: first } = await startLogin();

    const second = browser.login(loginUrl, redirectTo);

    await expect(first).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve));
    redirect(redirectedTo);
    await expect(second).resolves.toBe(redirectedTo);
  });
});
