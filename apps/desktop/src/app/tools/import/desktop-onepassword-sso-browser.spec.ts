import { OnePasswordSsoSignInClosedError } from "@bitwarden/importer-ui";

import { OnePasswordSsoLoginOutcome } from "../../../types/onepassword-sso-login-outcome";

import { DesktopOnePasswordSsoBrowser } from "./desktop-onepassword-sso-browser";

describe("DesktopOnePasswordSsoBrowser", () => {
  const loginUrl = "https://idp.example.com/login";
  const redirectTo = "https://my.1password.com/sso/oidc/redirect/";

  let login: jest.Mock<Promise<OnePasswordSsoLoginOutcome>, [string, string]>;
  let browser: DesktopOnePasswordSsoBrowser;

  beforeEach(() => {
    login = jest.fn();
    (global as any).ipc = { tools: { onePasswordSso: { login, cancel: jest.fn() } } };
    browser = new DesktopOnePasswordSsoBrowser();
  });

  it("resolves with the address the identity provider redirected to", async () => {
    const redirectedTo = `${redirectTo}?code=abc`;
    login.mockResolvedValue({ status: "redirected", redirectedTo });

    await expect(browser.login(loginUrl, redirectTo)).resolves.toBe(redirectedTo);
    expect(login).toHaveBeenCalledWith(loginUrl, redirectTo);
  });

  it("fails when the user closes the window", async () => {
    login.mockResolvedValue({ status: "closed" });

    await expect(browser.login(loginUrl, redirectTo)).rejects.toBeInstanceOf(
      OnePasswordSsoSignInClosedError,
    );
  });

  it("resolves with nothing when the sign-in is called off", async () => {
    login.mockResolvedValue({ status: "canceled" });

    await expect(browser.login(loginUrl, redirectTo)).resolves.toBeUndefined();
  });
});
