import { MockProxy } from "jest-mock-extended";
import { Jsonify } from "type-fest";

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
import { LoginUriApi } from "../api/login-uri.api";
import { LoginUriData } from "../data/login-uri.data";

import { LoginUri } from "./login-uri";

describe("LoginUri", () => {
  let data: LoginUriData;
  let encryptService: MockProxy<EncryptService>;

  beforeEach(() => {
    data = {
      uri: "encUri",
      uriChecksum: "encUriChecksum",
      match: UriMatchStrategy.Domain,
    };

    const containerService = mockContainerService();
    encryptService = containerService.getEncryptService();
  });

  it("Convert from empty", () => {
    const data = new LoginUriData();
    const loginUri = new LoginUri(data);

    expect(loginUri).toEqual({
      match: undefined,
      uri: undefined,
      uriChecksum: undefined,
    });
    expect(data.uri).toBeUndefined();
    expect(data.uriChecksum).toBeUndefined();
    expect(data.match).toBeUndefined();
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
    const loginUri = new LoginUri();
    loginUri.match = UriMatchStrategy.Exact;
    loginUri.uri = mockEnc("uri");

    const view = await loginUri.decrypt(null);

    expect(view).toEqual({
      _uri: "uri",
      match: 3,
    });
  });

  it("handle null match", () => {
    const apiData = Object.assign(new LoginUriApi(), {
      uri: "testUri",
      uriChecksum: "testChecksum",
      match: null,
    });

    const loginUriData = new LoginUriData(apiData);

    // The data model stores it as-is (null or undefined)
    expect(loginUriData.match).toBeNull();

    // But the domain model converts null to undefined
    const loginUri = new LoginUri(loginUriData);
    expect(loginUri.match).toBeUndefined();
  });

  describe("validateChecksum", () => {
    it("returns true if checksums match", async () => {
      const loginUri = new LoginUri();
      loginUri.uriChecksum = mockEnc("checksum");
      encryptService.hash.mockResolvedValue("checksum");

      const key = makeSymmetricCryptoKey(64);
      const actual = await loginUri.validateChecksum("uri", key);

      expect(actual).toBe(true);
      expect(encryptService.hash).toHaveBeenCalledWith("uri", "sha256");
    });

    it("returns false if checksums don't match", async () => {
      const loginUri = new LoginUri();
      loginUri.uriChecksum = mockEnc("checksum");
      encryptService.hash.mockResolvedValue("incorrect checksum");

      const actual = await loginUri.validateChecksum("uri", undefined);

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
    it("maps to SDK login uri", () => {
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
