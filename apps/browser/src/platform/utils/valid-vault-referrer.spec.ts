import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import {
  Environment,
  EnvironmentService,
  Region,
  RegionConfig,
} from "@bitwarden/common/platform/abstractions/environment.service";

import { isValidVaultReferrer } from "./valid-vault-referrer";

describe("isValidVaultReferrer", () => {
  let environmentService: MockProxy<EnvironmentService>;

  /** Points the service at a configured web vault and a set of selectable regions. */
  const configure = (webVaultUrl: string, regions: RegionConfig[]) => {
    environmentService.environment$ = new BehaviorSubject({
      getWebVaultUrl: () => webVaultUrl,
    } as Environment);
    environmentService.availableRegions.mockReturnValue(regions);
  };

  const usRegion = {
    key: Region.US,
    domain: "bitwarden.com",
    urls: { webVault: "https://vault.bitwarden.com" },
  } as RegionConfig;

  const euRegion = {
    key: Region.EU,
    domain: "bitwarden.eu",
    urls: { webVault: "https://vault.bitwarden.eu" },
  } as RegionConfig;

  beforeEach(() => {
    environmentService = mock<EnvironmentService>();
    configure("https://vault.bitwarden.com", [usRegion, euRegion]);
  });

  it("accepts the hostname of the configured web vault", async () => {
    configure("https://vault.selfhosted.test", []);

    await expect(isValidVaultReferrer(environmentService, "vault.selfhosted.test")).resolves.toBe(
      true,
    );
  });

  it("accepts the hostname of any selectable region, even when it is not the configured one", async () => {
    configure("https://vault.bitwarden.com", [usRegion, euRegion]);

    await expect(isValidVaultReferrer(environmentService, "vault.bitwarden.eu")).resolves.toBe(
      true,
    );
  });

  it("accepts a self-hosted web vault served under a path", async () => {
    configure("https://selfhosted.test/bitwarden", []);

    await expect(isValidVaultReferrer(environmentService, "selfhosted.test")).resolves.toBe(true);
  });

  it("falls back to the region's base URL when it declares no web vault URL", async () => {
    configure("https://vault.bitwarden.com", [
      { key: Region.SelfHosted, domain: "base.test", urls: { base: "https://base.test" } },
    ] as RegionConfig[]);

    await expect(isValidVaultReferrer(environmentService, "base.test")).resolves.toBe(true);
  });

  it("skips a region that declares neither a web vault nor a base URL", async () => {
    configure("https://vault.bitwarden.com", [
      { key: Region.SelfHosted, domain: "incomplete.test", urls: {} },
      usRegion,
    ] as RegionConfig[]);

    await expect(isValidVaultReferrer(environmentService, "vault.bitwarden.com")).resolves.toBe(
      true,
    );
    await expect(isValidVaultReferrer(environmentService, "incomplete.test")).resolves.toBe(false);
  });

  it("rejects an unrelated hostname", async () => {
    await expect(isValidVaultReferrer(environmentService, "attacker.test")).resolves.toBe(false);
  });

  it("rejects a hostname that merely contains a known vault hostname", async () => {
    await expect(
      isValidVaultReferrer(environmentService, "vault.bitwarden.com.attacker.test"),
    ).resolves.toBe(false);
  });

  it.each([null, undefined, ""])("rejects a %p referrer", async (referrer) => {
    await expect(isValidVaultReferrer(environmentService, referrer)).resolves.toBe(false);
  });

  it("rejects the opaque-origin marker a sandboxed frame produces", async () => {
    await expect(isValidVaultReferrer(environmentService, "null")).resolves.toBe(false);
  });
});
