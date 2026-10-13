import { SsoRequiredCacheEntry } from "../../abstractions/sso-login.service.abstraction";

import { SSO_REQUIRED_CACHE } from "./sso-login.state";

// TODO: Delete these tests as part of https://bitwarden.atlassian.net/browse/PM-35145, as they
//       will become irrelevant.
describe("SSO_REQUIRED_CACHE deserializer", () => {
  const deserialize = (value: unknown) =>
    SSO_REQUIRED_CACHE.deserializer(value as SsoRequiredCacheEntry[]);

  it("should return null as-is", () => {
    expect(deserialize(null)).toBeNull();
  });

  it("should return an empty array as-is", () => {
    expect(deserialize([])).toEqual([]);
  });

  it("should return null when the cache contains the old string[] format", () => {
    expect(deserialize(["user@example.com"])).toBeNull();
  });

  it("should return null when the cache contains multiple entries in the old string[] format", () => {
    expect(deserialize(["user1@example.com", "user2@example.com"])).toBeNull();
  });

  it("should return the cache unchanged when it contains the new SsoRequiredCacheEntry[] format", () => {
    const cache: SsoRequiredCacheEntry[] = [
      { email: "user@example.com", webVaultUrl: "https://vault.bitwarden.com" },
    ];

    expect(deserialize(cache)).toEqual(cache);
  });
});
