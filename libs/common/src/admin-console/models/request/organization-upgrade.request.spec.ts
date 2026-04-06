import { OrganizationKeysRequest } from "./organization-keys.request";
import { OrganizationUpgradeRequest } from "./organization-upgrade.request";

describe("OrganizationUpgradeRequest", () => {
  it("should omit keys from JSON when not set", () => {
    const request = new OrganizationUpgradeRequest();

    const json = JSON.stringify(request);
    const parsed = JSON.parse(json);

    expect(parsed.keys).toBeUndefined();
    expect("keys" in parsed).toBe(false);
  });

  it("should include keys in JSON when set", () => {
    const request = new OrganizationUpgradeRequest();
    request.keys = new OrganizationKeysRequest("public-key", "encrypted-private-key");

    const json = JSON.stringify(request);
    const parsed = JSON.parse(json);

    expect(parsed.keys).toBeDefined();
    expect(parsed.keys.publicKey).toBe("public-key");
    expect(parsed.keys.encryptedPrivateKey).toBe("encrypted-private-key");
  });

  it("should initialize numeric fields to zero", () => {
    const request = new OrganizationUpgradeRequest();

    expect(request.additionalSeats).toBe(0);
    expect(request.additionalStorageGb).toBe(0);
    expect(request.additionalSmSeats).toBe(0);
    expect(request.additionalServiceAccounts).toBe(0);
  });

  it("should initialize boolean fields to false", () => {
    const request = new OrganizationUpgradeRequest();

    expect(request.premiumAccessAddon).toBe(false);
    expect(request.useSecretsManager).toBe(false);
  });
});
