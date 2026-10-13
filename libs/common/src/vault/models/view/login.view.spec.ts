import { LoginView as SdkLoginView } from "@bitwarden/sdk-internal";

import { mockFromJson, mockFromSdk } from "../../../../spec";

import { LoginUriView } from "./login-uri.view";
import { LoginView } from "./login.view";

jest.mock("../../models/view/login-uri.view");

describe("LoginView", () => {
  beforeEach(() => {
    (LoginUriView as any).mockClear();
  });

  it("fromJSON initializes nested objects", () => {
    jest.spyOn(LoginUriView, "fromJSON").mockImplementation(mockFromJson);

    const passwordRevisionDate = new Date();

    const actual = LoginView.fromJSON({
      passwordRevisionDate: passwordRevisionDate.toISOString(),
      uris: ["uri1", "uri2", "uri3"] as any,
    });

    expect(actual).toMatchObject({
      passwordRevisionDate: passwordRevisionDate,
      uris: ["uri1_fromJSON", "uri2_fromJSON", "uri3_fromJSON"],
    });
  });

  describe("fromSdkLoginView", () => {
    it("should return a LoginView from an SdkLoginView", () => {
      jest.spyOn(LoginUriView, "fromSdkLoginUriView").mockImplementation(mockFromSdk);

      const sdkLoginView = {
        username: "username",
        password: "password",
        passwordRevisionDate: "2025-01-01T01:06:40.441Z",
        uris: [{ uri: "bitwarden.com" } as any],
        totp: "totp",
        autofillOnPageLoad: true,
      } as SdkLoginView;

      const result = LoginView.fromSdkLoginView(sdkLoginView);

      expect(result).toMatchObject({
        username: "username",
        password: "password",
        passwordRevisionDate: new Date("2025-01-01T01:06:40.441Z"),
        uris: [expect.objectContaining({ uri: "bitwarden.com", __fromSdk: true })],
        totp: "totp",
        autofillOnPageLoad: true,
      });
    });
  });

  describe("toSdkLoginView", () => {
    it("should convert populated fields", () => {
      const loginView = new LoginView();
      loginView.username = "user";
      loginView.password = "pass";
      loginView.totp = "TOTP_SEED";

      const result = loginView.toSdkLoginView();

      expect(result.username).toBe("user");
      expect(result.password).toBe("pass");
      expect(result.totp).toBe("TOTP_SEED");
    });

    it("should convert empty username and password to undefined", () => {
      const loginView = new LoginView();
      loginView.username = "";
      loginView.password = "";
      loginView.totp = "";

      const result = loginView.toSdkLoginView();

      expect(result.username).toBeUndefined();
      expect(result.password).toBeUndefined();
      expect(result.totp).toBeUndefined();
    });

    it("should convert null/undefined fields to undefined", () => {
      const loginView = new LoginView();
      loginView.username = undefined;
      loginView.password = undefined;
      loginView.totp = undefined;

      const result = loginView.toSdkLoginView();

      expect(result.username).toBeUndefined();
      expect(result.password).toBeUndefined();
      expect(result.totp).toBeUndefined();
    });
  });
});
