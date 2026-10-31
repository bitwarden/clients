import { TestBed } from "@angular/core/testing";

import { OnePasswordSsoBrowser } from "./onepassword-sso-browser";

describe("OnePasswordSsoBrowser when a client provides no browser of its own", () => {
  let browser: OnePasswordSsoBrowser;

  beforeEach(() => {
    browser = TestBed.inject(OnePasswordSsoBrowser);
  });

  it("does not support single sign-on", () => {
    expect(browser.supported).toBe(false);
  });

  it("refuses to log in", async () => {
    await expect(
      browser.login("https://idp.example.com/login", "https://my.1password.com/sso/oidc/redirect/"),
    ).rejects.toThrow("not supported");
  });

  it("does nothing to cancel", () => {
    expect(() => browser.cancel()).not.toThrow();
  });
});
