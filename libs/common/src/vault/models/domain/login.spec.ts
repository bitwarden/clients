// eslint-disable-next-line no-restricted-imports
import { Substitute, Arg } from "@fluffy-spoon/substitute";

import { mockEnc, mockFromJson } from "../../../../spec";
import { UriMatchType } from "../../../enums";
import { EncryptedString, EncString } from "../../../platform/models/domain/enc-string";
import { LoginData } from "../../models/data/login.data";
import { Login } from "../../models/domain/login";
import { LoginUri } from "../../models/domain/login-uri";
import { LoginUriView } from "../../models/view/login-uri.view";

describe("Login DTO", () => {
  it("Convert from empty LoginData", () => {
    const data = new LoginData();
    const login = new Login(data);

    expect(login).toEqual({
      passwordRevisionDate: null,
      autofillOnPageLoad: undefined,
      username: null,
      password: null,
      totp: null,
    });
  });

  it("Convert from full LoginData", () => {
    const data: LoginData = {
      uris: [{ uri: "uri", match: UriMatchType.Domain }],
      username: "username",
      password: "password",
      passwordRevisionDate: "2022-01-31T12:00:00.000Z",
      totp: "123",
      autofillOnPageLoad: false,
    };
    const login = new Login(data);

    expect(login).toEqual({
      passwordRevisionDate: new Date("2022-01-31T12:00:00.000Z"),
      autofillOnPageLoad: false,
      username: { encryptedString: "username", encryptionType: 0 },
      password: { encryptedString: "password", encryptionType: 0 },
      totp: { encryptedString: "123", encryptionType: 0 },
      uris: [{ match: 0, uri: { encryptedString: "uri", encryptionType: 0 } }],
    });
  });

  it("Initialize without LoginData", () => {
    const login = new Login();

    expect(login).toEqual({});
  });

  it("Decrypts correctly", async () => {
    const loginUri = Substitute.for<LoginUri>();
    const loginUriView = new LoginUriView();
    loginUriView.uri = "decrypted uri";
    loginUri.decrypt(Arg.any()).resolves(loginUriView);

    const login = new Login();
    login.uris = [loginUri];
    login.username = mockEnc("encrypted username");
    login.password = mockEnc("encrypted password");
    login.passwordRevisionDate = new Date("2022-01-31T12:00:00.000Z");
    login.totp = mockEnc("encrypted totp");
    login.autofillOnPageLoad = true;

    const loginView = await login.decrypt(null);
    expect(loginView).toEqual({
      username: "encrypted username",
      password: "encrypted password",
      passwordRevisionDate: new Date("2022-01-31T12:00:00.000Z"),
      totp: "encrypted totp",
      uris: [
        {
          match: null,
          _uri: "decrypted uri",
          _domain: null,
          _hostname: null,
          _host: null,
          _canLaunch: null,
        },
      ],
      autofillOnPageLoad: true,
    });
  });

  it("Converts from LoginData and back", () => {
    const data: LoginData = {
      uris: [{ uri: "uri", match: UriMatchType.Domain }],
      username: "username",
      password: "password",
      passwordRevisionDate: "2022-01-31T12:00:00.000Z",
      totp: "123",
      autofillOnPageLoad: false,
    };
    const login = new Login(data);

    const loginData = login.toLoginData();

    expect(loginData).toEqual(data);
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      jest.spyOn(EncString, "fromJSON").mockImplementation(mockFromJson);
      jest.spyOn(LoginUri, "fromJSON").mockImplementation(mockFromJson);
      const passwordRevisionDate = new Date("2022-01-31T12:00:00.000Z");

      const actual = Login.fromJSON({
        uris: ["loginUri1", "loginUri2"] as any,
        username: "myUsername" as EncryptedString,
        password: "myPassword" as EncryptedString,
        passwordRevisionDate: passwordRevisionDate.toISOString(),
        totp: "myTotp" as EncryptedString,
      });

      expect(actual).toEqual({
        uris: ["loginUri1_fromJSON", "loginUri2_fromJSON"] as any,
        username: "myUsername_fromJSON",
        password: "myPassword_fromJSON",
        passwordRevisionDate: passwordRevisionDate,
        totp: "myTotp_fromJSON",
      });
      expect(actual).toBeInstanceOf(Login);
    });

    it("returns null if object is null", () => {
      expect(Login.fromJSON(null)).toBeNull();
    });
  });
});
