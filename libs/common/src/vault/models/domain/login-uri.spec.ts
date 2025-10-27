import { MockProxy } from "jest-mock-extended";
import { of } from "rxjs";
import { Jsonify } from "type-fest";

import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import { UriMatchType } from "@bitwarden/sdk-internal";

import {
  makeSymmetricCryptoKey,
  mockContainerService,
  mockEnc,
  mockFromJson,
} from "../../../../spec";
import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { UriMatchStrategy } from "../../../models/domain/domain-service";
import { LoginUriData } from "../data/login-uri.data";

import { LoginUri } from "./login-uri";

describe("LoginUri", () => {
  let data: LoginUriData;

  beforeEach(() => {
    data = {
      uri: "encUri",
      uriChecksum: "encUriChecksum",
      match: UriMatchStrategy.Domain,
    };
  });

  it("Convert from empty", () => {
    const data = new LoginUriData();
    const loginUri = new LoginUri(data);

    expect(loginUri).toEqual({
      match: undefined,
      uri: undefined,
      uriChecksum: undefined,
    });
  });

  it("Convert", () => {
    const loginUri = new LoginUri(data);

    expect(loginUri).toEqual({
      match: 0,
      uri: { encryptedString: "encUri", encryptionType: 0 },
      uriChecksum: { encryptedString: "encUriChecksum", encryptionType: 0 },
    });
  });

  it("toLoginUriData", () => {
    const loginUri = new LoginUri(data);
    expect(loginUri.toLoginUriData()).toEqual(data);
  });

  it("Decrypt", async () => {
    const containerService = mockContainerService();
    containerService
      .getKeyService()
      .userKey$.mockReturnValue(of(makeSymmetricCryptoKey(64) as UserKey));
    containerService
      .getEncryptService()
      .decryptString.mockImplementation(async (encString: EncString, key: SymmetricCryptoKey) => {
        return encString.data;
      });

    const loginUri = new LoginUri();
    loginUri.match = UriMatchStrategy.Exact;
    loginUri.uri = mockEnc("uri");

    const view = await loginUri.decrypt(null, null);

    expect(view).toEqual({
      _uri: "uri",
      match: 3,
    });
  });

  describe("validateChecksum", () => {
    let encryptService: MockProxy<EncryptService>;

    beforeEach(() => {
      const containerService = mockContainerService();
      encryptService = containerService.getEncryptService();

      containerService
        .getKeyService()
        .userKey$.mockReturnValue(of(makeSymmetricCryptoKey(64) as UserKey));
      containerService
        .getEncryptService()
        .decryptString.mockImplementation(async (encString: EncString, key: SymmetricCryptoKey) => {
          return encString.data;
        });
    });

    it("returns true if checksums match", async () => {
      const loginUri = new LoginUri();
      loginUri.uriChecksum = mockEnc("checksum");
      encryptService.hash.mockResolvedValue("checksum");

      const actual = await loginUri.validateChecksum("uri", undefined, undefined, undefined);

      expect(actual).toBe(true);
      expect(encryptService.hash).toHaveBeenCalledWith("uri", "sha256");
    });

    it("returns false if checksums don't match", async () => {
      const loginUri = new LoginUri();
      loginUri.uriChecksum = mockEnc("checksum");
      encryptService.hash.mockResolvedValue("incorrect checksum");

      const actual = await loginUri.validateChecksum("uri", undefined, undefined, undefined);

      expect(actual).toBe(false);
    });
  });

  describe("fromJSON", () => {
    it("initializes nested objects", () => {
      jest.spyOn(EncString, "fromJSON").mockImplementation(mockFromJson);

      const actual = LoginUri.fromJSON({
        uri: "myUri",
        uriChecksum: "myUriChecksum",
        match: UriMatchStrategy.Domain,
      } as Jsonify<LoginUri>);

      expect(actual).toEqual({
        uri: "myUri_fromJSON",
        uriChecksum: "myUriChecksum_fromJSON",
        match: UriMatchStrategy.Domain,
      });
      expect(actual).toBeInstanceOf(LoginUri);
    });

    it("returns undefined if object is null", () => {
      expect(LoginUri.fromJSON(null)).toBeUndefined();
    });
  });

  describe("SDK Login Uri Mapping", () => {
    it("should map to SDK login uri", () => {
      const loginUri = new LoginUri(data);
      const sdkLoginUri = loginUri.toSdkLoginUri();

      expect(sdkLoginUri).toEqual({
        uri: "encUri",
        uriChecksum: "encUriChecksum",
        match: UriMatchType.Domain,
      });
    });
  });
});
