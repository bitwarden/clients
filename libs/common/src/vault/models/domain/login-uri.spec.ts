import { Jsonify } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";
import { UriMatchType } from "@bitwarden/sdk-internal";

import { mockFromJson } from "../../../../spec";
import { UriMatchStrategy } from "../../../models/domain/domain-service";
import { LoginUriApi } from "../api/login-uri.api";
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
