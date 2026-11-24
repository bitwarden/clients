import { EncString } from "@bitwarden/sdk-internal";

import { mockContainerService, mockFromJson } from "../../../../spec";
import { UriMatchStrategy } from "../../../models/domain/domain-service";
import { LoginData } from "../../models/data/login.data";
import { Login } from "../../models/domain/login";
import { LoginUri } from "../../models/domain/login-uri";
import { Fido2CredentialApi } from "../api/fido2-credential.api";
import { Fido2CredentialData } from "../data/fido2-credential.data";
import { Fido2CredentialView } from "../view/fido2-credential.view";

import { Fido2Credential } from "./fido2-credential";

describe("Login DTO", () => {
  beforeEach(() => {
    mockContainerService();
  });

  it("Convert from empty LoginData", () => {
    const data = new LoginData();
    const login = new Login(data);

    expect(login).toEqual({
      passwordRevisionDate: undefined,
      autofillOnPageLoad: undefined,
      username: undefined,
      password: undefined,
      totp: undefined,
    });

    expect(data.username).toBeUndefined();
    expect(data.password).toBeUndefined();
    expect(data.passwordRevisionDate).toBeUndefined();
    expect(data.totp).toBeUndefined();
    expect(data.autofillOnPageLoad).toBeUndefined();
    expect(data.httpAuthenticationEnabled).toBeUndefined();
    expect(data.uris).toBeUndefined();
    expect(data.fido2Credentials).toBeUndefined();
  });

  it("Convert from full LoginData", () => {
    const fido2CredentialData = initializeFido2Credential(new Fido2CredentialData());
    const data: LoginData = {
      uris: [{ uri: "uri", uriChecksum: "checksum", match: UriMatchStrategy.Domain }],
      username: "username",
      password: "password",
      passwordRevisionDate: "2022-01-31T12:00:00.000Z",
      totp: "123",
      autofillOnPageLoad: false,
      httpAuthenticationEnabled: true,
      fido2Credentials: [fido2CredentialData],
    };
    const login = new Login(data);

    expect(login).toEqual({
      passwordRevisionDate: new Date("2022-01-31T12:00:00.000Z"),
      autofillOnPageLoad: false,
      httpAuthenticationEnabled: true,
      username: "username",
      password: "password",
      totp: "123",
      uris: [
        {
          match: 0,
          uri: "uri",
          uriChecksum: "checksum",
        },
      ],
      fido2Credentials: [encryptFido2Credential(fido2CredentialData)],
    });
  });

  it("Initialize without LoginData", () => {
    const login = new Login();

    expect(login).toEqual({});
  });

  it("Converts from LoginData and back", () => {
    const data: LoginData = {
      uris: [{ uri: "uri", uriChecksum: "checksum", match: UriMatchStrategy.Domain }],
      username: "username",
      password: "password",
      passwordRevisionDate: "2022-01-31T12:00:00.000Z",
      totp: "123",
      autofillOnPageLoad: false,
      httpAuthenticationEnabled: true,
      fido2Credentials: [initializeFido2Credential(new Fido2CredentialData())],
    };
    const login = new Login(data);

    const loginData = login.toLoginData();

    expect(loginData).toEqual(data);
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      jest.spyOn(LoginUri, "fromJSON").mockImplementation(mockFromJson);
      const passwordRevisionDate = new Date("2022-01-31T12:00:00.000Z");
      const fido2CreationDate = new Date("2023-01-01T12:00:00.000Z");

      const actual = Login.fromJSON({
        uris: ["loginUri1", "loginUri2"] as any,
        username: "myUsername" as EncString,
        password: "myPassword" as EncString,
        passwordRevisionDate: passwordRevisionDate.toISOString(),
        totp: "myTotp" as EncString,
        // NOTE: `as any` is here until we migrate to Nx: https://bitwarden.atlassian.net/browse/PM-6493
        fido2Credentials: [
          {
            credentialId: "keyId" as EncString,
            keyType: "keyType" as EncString,
            keyAlgorithm: "keyAlgorithm" as EncString,
            keyCurve: "keyCurve" as EncString,
            keyValue: "keyValue" as EncString,
            rpId: "rpId" as EncString,
            userHandle: "userHandle" as EncString,
            userName: "userName" as EncString,
            counter: "counter" as EncString,
            rpName: "rpName" as EncString,
            userDisplayName: "userDisplayName" as EncString,
            discoverable: "discoverable" as EncString,
            creationDate: fido2CreationDate.toISOString(),
          },
        ] as any,
      });

      expect(actual).toEqual({
        uris: ["loginUri1_fromJSON", "loginUri2_fromJSON"] as any,
        username: "myUsername",
        password: "myPassword",
        passwordRevisionDate: passwordRevisionDate,
        totp: "myTotp",
        fido2Credentials: [
          {
            credentialId: "keyId",
            keyType: "keyType",
            keyAlgorithm: "keyAlgorithm",
            keyCurve: "keyCurve",
            keyValue: "keyValue",
            rpId: "rpId",
            userHandle: "userHandle",
            userName: "userName",
            counter: "counter",
            rpName: "rpName",
            userDisplayName: "userDisplayName",
            discoverable: "discoverable",
            creationDate: fido2CreationDate,
          },
        ],
      });
      expect(actual).toBeInstanceOf(Login);
    });

    it("returns undefined if object is null", () => {
      expect(Login.fromJSON(null)).toBeUndefined();
    });

    it("keeps the HTTP authentication setting", () => {
      expect(Login.fromJSON({ httpAuthenticationEnabled: true }).httpAuthenticationEnabled).toBe(
        true,
      );
    });
  });

  describe("fromSdkLogin", () => {
    it("keeps the HTTP authentication setting", () => {
      expect(
        Login.fromSdkLogin({ httpAuthenticationEnabled: true }).httpAuthenticationEnabled,
      ).toBe(true);
    });

    it("leaves the HTTP authentication setting unset when the SDK login has none", () => {
      expect(Login.fromSdkLogin({}).httpAuthenticationEnabled).toBeUndefined();
    });
  });

  describe("toSdkLogin", () => {
    it("should map to SDK login", () => {
      const data: LoginData = {
        uris: [{ uri: "uri", uriChecksum: "checksum", match: UriMatchStrategy.Domain }],
        username: "username",
        password: "password",
        passwordRevisionDate: "2022-01-31T12:00:00.000Z",
        totp: "123",
        autofillOnPageLoad: false,
        httpAuthenticationEnabled: true,
        fido2Credentials: [initializeFido2Credential(new Fido2CredentialData())],
      };
      const login = new Login(data);
      const sdkLogin = login.toSdkLogin();

      expect(sdkLogin).toEqual({
        username: "username",
        password: "password",
        passwordRevisionDate: "2022-01-31T12:00:00.000Z",
        uris: [
          {
            match: 0,
            uri: "uri",
            uriChecksum: "checksum",
          },
        ],
        totp: "123",
        autofillOnPageLoad: false,
        httpAuthenticationEnabled: true,
        fido2Credentials: [
          {
            credentialId: "credentialId",
            keyType: "public-key",
            keyAlgorithm: "ECDSA",
            keyCurve: "P-256",
            keyValue: "keyValue",
            rpId: "rpId",
            userHandle: "userHandle",
            userName: "userName",
            counter: "counter",
            rpName: "rpName",
            userDisplayName: "userDisplayName",
            discoverable: "discoverable",
            creationDate: "2023-01-01T12:00:00.000Z",
          },
        ],
      });
    });
  });
});

type Fido2CredentialLike = Fido2CredentialData | Fido2CredentialView | Fido2CredentialApi;
function initializeFido2Credential<T extends Fido2CredentialLike>(key: T): T {
  key.credentialId = "credentialId";
  key.keyType = "public-key";
  key.keyAlgorithm = "ECDSA";
  key.keyCurve = "P-256";
  key.keyValue = "keyValue";
  key.rpId = "rpId";
  key.userHandle = "userHandle";
  key.userName = "userName";
  key.counter = "counter";
  key.rpName = "rpName";
  key.userDisplayName = "userDisplayName";
  key.discoverable = "discoverable";
  key.creationDate = "2023-01-01T12:00:00.000Z";
  return key;
}

function encryptFido2Credential(key: Fido2CredentialLike): Fido2Credential {
  const encrypted = new Fido2Credential();
  encrypted.credentialId = key.credentialId as EncString;
  encrypted.keyType = key.keyType as EncString;
  encrypted.keyAlgorithm = key.keyAlgorithm as EncString;
  encrypted.keyCurve = key.keyCurve as EncString;
  encrypted.keyValue = key.keyValue as EncString;
  encrypted.rpId = key.rpId as EncString;
  encrypted.userHandle = key.userHandle as EncString;
  encrypted.userName = key.userName as EncString;
  encrypted.counter = key.counter as EncString;
  encrypted.rpName = key.rpName as EncString;
  encrypted.userDisplayName = key.userDisplayName as EncString;
  encrypted.discoverable = key.discoverable as EncString;

  // not encrypted
  encrypted.creationDate = new Date(key.creationDate);
  return encrypted;
}
