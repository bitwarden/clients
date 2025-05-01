import { MockProxy, mock } from "jest-mock-extended";

import { mockEnc, mockFromJson } from "../../../../spec";
import { UriMatchStrategy, UriMatchStrategySetting } from "../../../models/domain/domain-service";
import { EncryptedString, EncString } from "../../../platform/models/domain/enc-string";
import { LoginData } from "../../models/data/login.data";
import { Login } from "../../models/domain/login";
import { LoginUri } from "../../models/domain/login-uri";
import { LoginUriView } from "../../models/view/login-uri.view";
import { Fido2CredentialApi } from "../api/fido2-credential.api";
import { Fido2CredentialData } from "../data/fido2-credential.data";
import { Fido2CredentialView } from "../view/fido2-credential.view";

import { Fido2Credential } from "./fido2-credential";

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
    const fido2CredentialData = initializeFido2Credential(new Fido2CredentialData());
    const data: LoginData = {
      uris: [{ uri: "uri", uriChecksum: "checksum", match: UriMatchStrategy.Domain }],
      username: "username",
      password: "password",
      passwordRevisionDate: "2022-01-31T12:00:00.000Z",
      totp: "123",
      autofillOnPageLoad: false,
      fido2Credentials: [fido2CredentialData],
    };
    const login = new Login(data);

    expect(login).toEqual({
      passwordRevisionDate: new Date("2022-01-31T12:00:00.000Z"),
      autofillOnPageLoad: false,
      username: { encryptedString: "username", encryptionType: 0 },
      password: { encryptedString: "password", encryptionType: 0 },
      totp: { encryptedString: "123", encryptionType: 0 },
      uris: [
        {
          match: 0,
          uri: { encryptedString: "uri", encryptionType: 0 },
          uriChecksum: { encryptedString: "checksum", encryptionType: 0 },
        },
      ],
      fido2Credentials: [encryptFido2Credential(fido2CredentialData)],
    });
  });

  it("Initialize without LoginData", () => {
    const login = new Login();

    expect(login).toEqual({});
  });

  describe("decrypt", () => {
    let loginUri: MockProxy<LoginUri>;
    const loginUriView = new LoginUriView();
    const decryptedFido2Credential = Symbol();
    const login = Object.assign(new Login(), {
      username: mockEnc("encrypted username"),
      password: mockEnc("encrypted password"),
      passwordRevisionDate: new Date("2022-01-31T12:00:00.000Z"),
      totp: mockEnc("encrypted totp"),
      autofillOnPageLoad: true,
      fido2Credentials: [{ decrypt: jest.fn().mockReturnValue(decryptedFido2Credential) } as any],
    });
    const expectedView = {
      username: "encrypted username",
      password: "encrypted password",
      passwordRevisionDate: new Date("2022-01-31T12:00:00.000Z"),
      totp: "encrypted totp",
      uris: [
        {
          match: null as UriMatchStrategySetting,
          _uri: "decrypted uri",
          _domain: null as string,
          _hostname: null as string,
          _host: null as string,
          _canLaunch: null as boolean,
        },
      ],
      autofillOnPageLoad: true,
      fido2Credentials: [decryptedFido2Credential],
    };

    beforeEach(() => {
      loginUri = mock();
      loginUriView.uri = "decrypted uri";
    });

    it("should decrypt to a view", async () => {
      loginUri.decrypt.mockResolvedValue(loginUriView);
      loginUri.validateChecksum.mockResolvedValue(true);
      login.uris = [loginUri];

      const loginView = await login.decrypt(null, true);
      expect(loginView).toEqual(expectedView);
    });

    it("should ignore uris that fail checksum", async () => {
      loginUri.decrypt.mockResolvedValue(loginUriView);
      loginUri.validateChecksum
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      login.uris = [loginUri, loginUri, loginUri];

      const loginView = await login.decrypt(null, false);
      expect(loginView).toEqual(expectedView);
    });
  });

  it("Converts from LoginData and back", () => {
    const data: LoginData = {
      uris: [{ uri: "uri", uriChecksum: "checksum", match: UriMatchStrategy.Domain }],
      username: "username",
      password: "password",
      passwordRevisionDate: "2022-01-31T12:00:00.000Z",
      totp: "123",
      autofillOnPageLoad: false,
      fido2Credentials: [initializeFido2Credential(new Fido2CredentialData())],
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
      const fido2CreationDate = new Date("2023-01-01T12:00:00.000Z");

      const actual = Login.fromJSON({
        uris: ["loginUri1", "loginUri2"] as any,
        username: "myUsername" as EncryptedString,
        password: "myPassword" as EncryptedString,
        passwordRevisionDate: passwordRevisionDate.toISOString(),
        totp: "myTotp" as EncryptedString,
        // NOTE: `as any` is here until we migrate to Nx: https://bitwarden.atlassian.net/browse/PM-6493
        fido2Credentials: [
          {
            credentialId: "keyId" as EncryptedString,
            keyType: "keyType" as EncryptedString,
            keyAlgorithm: "keyAlgorithm" as EncryptedString,
            keyCurve: "keyCurve" as EncryptedString,
            keyValue: "keyValue" as EncryptedString,
            rpId: "rpId" as EncryptedString,
            userHandle: "userHandle" as EncryptedString,
            userName: "userName" as EncryptedString,
            counter: "counter" as EncryptedString,
            rpName: "rpName" as EncryptedString,
            userDisplayName: "userDisplayName" as EncryptedString,
            discoverable: "discoverable" as EncryptedString,
            creationDate: fido2CreationDate.toISOString(),
          },
        ] as any,
      });

      expect(actual).toEqual({
        uris: ["loginUri1_fromJSON", "loginUri2_fromJSON"] as any,
        username: "myUsername_fromJSON",
        password: "myPassword_fromJSON",
        passwordRevisionDate: passwordRevisionDate,
        totp: "myTotp_fromJSON",
        fido2Credentials: [
          {
            credentialId: "keyId_fromJSON",
            keyType: "keyType_fromJSON",
            keyAlgorithm: "keyAlgorithm_fromJSON",
            keyCurve: "keyCurve_fromJSON",
            keyValue: "keyValue_fromJSON",
            rpId: "rpId_fromJSON",
            userHandle: "userHandle_fromJSON",
            userName: "userName_fromJSON",
            counter: "counter_fromJSON",
            rpName: "rpName_fromJSON",
            userDisplayName: "userDisplayName_fromJSON",
            discoverable: "discoverable_fromJSON",
            creationDate: fido2CreationDate,
          },
        ],
      });
      expect(actual).toBeInstanceOf(Login);
    });

    it("returns null if object is null", () => {
      expect(Login.fromJSON(null)).toBeNull();
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
  encrypted.credentialId = { encryptedString: key.credentialId, encryptionType: 0 } as EncString;
  encrypted.keyType = { encryptedString: key.keyType, encryptionType: 0 } as EncString;
  encrypted.keyAlgorithm = { encryptedString: key.keyAlgorithm, encryptionType: 0 } as EncString;
  encrypted.keyCurve = { encryptedString: key.keyCurve, encryptionType: 0 } as EncString;
  encrypted.keyValue = { encryptedString: key.keyValue, encryptionType: 0 } as EncString;
  encrypted.rpId = { encryptedString: key.rpId, encryptionType: 0 } as EncString;
  encrypted.userHandle = { encryptedString: key.userHandle, encryptionType: 0 } as EncString;
  encrypted.userName = { encryptedString: key.userName, encryptionType: 0 } as EncString;
  encrypted.counter = { encryptedString: key.counter, encryptionType: 0 } as EncString;
  encrypted.rpName = { encryptedString: key.rpName, encryptionType: 0 } as EncString;
  encrypted.userDisplayName = {
    encryptedString: key.userDisplayName,
    encryptionType: 0,
  } as EncString;
  encrypted.discoverable = { encryptedString: key.discoverable, encryptionType: 0 } as EncString;

  // not encrypted
  encrypted.creationDate = new Date(key.creationDate);
  return encrypted;
}
