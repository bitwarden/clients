import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { Region } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FakeStateProvider, awaitAsync, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { GroupPolicyEnvironment } from "../../admin-console/types/group-policy-environment";

import { BrowserEnvironmentService } from "./browser-environment.service";

describe("BrowserEnvironmentService", () => {
  const userId = "00000000-0000-1000-a000-000000000001" as UserId;

  let sut: BrowserEnvironmentService;

  beforeEach(() => {
    const accountService = mockAccountServiceWith(userId);
    const stateProvider = new FakeStateProvider(accountService);

    sut = new BrowserEnvironmentService(mock<LogService>(), stateProvider, accountService);
  });

  /** Applies the given managed policy and returns the global (pre-login) environment. */
  const applyPolicy = async (policy: GroupPolicyEnvironment) => {
    jest.spyOn(sut, "getManagedEnvironment").mockResolvedValue(policy);

    await sut.setUrlsToManagedEnvironment();
    await awaitAsync();

    return await firstValueFrom(sut.globalEnvironment$);
  };

  describe("setUrlsToManagedEnvironment", () => {
    describe("managed urls that belong to a Bitwarden cloud region", () => {
      it.each([
        {
          name: "EU with only base",
          policy: { base: "https://vault.bitwarden.eu" },
          region: Region.EU,
          hostname: "bitwarden.eu",
        },
        {
          name: "EU with base and notifications, as the docs describe",
          policy: {
            base: "https://vault.bitwarden.eu",
            notifications: "https://notifications.bitwarden.eu",
          },
          region: Region.EU,
          hostname: "bitwarden.eu",
        },
        {
          name: "EU with every key set to the region's own urls",
          policy: {
            base: "https://vault.bitwarden.eu",
            webVault: "https://vault.bitwarden.eu",
            api: "https://api.bitwarden.eu",
            identity: "https://identity.bitwarden.eu",
            icons: "https://icons.bitwarden.eu",
            notifications: "https://notifications.bitwarden.eu",
            events: "https://events.bitwarden.eu",
          },
          region: Region.EU,
          hostname: "bitwarden.eu",
        },
        {
          name: "US with only base",
          policy: { base: "https://vault.bitwarden.com" },
          region: Region.US,
          hostname: "bitwarden.com",
        },
        {
          name: "Gov with only base",
          policy: { base: "https://vault.bitwarden-gov.com" },
          region: Region.Gov,
          hostname: "bitwarden-gov.com",
        },
      ])("selects the region for $name", async ({ policy, region, hostname }) => {
        const env = await applyPolicy(policy);

        expect(env.getRegion()).toBe(region);
        expect(env.getHostname()).toBe(hostname);
        expect(env.isCloud()).toBe(true);
      });

      it.each([
        { name: "a trailing slash", base: "https://vault.bitwarden.eu/" },
        { name: "no scheme", base: "vault.bitwarden.eu" },
        { name: "upper case", base: "https://Vault.Bitwarden.EU" },
        { name: "surrounding whitespace", base: " https://vault.bitwarden.eu " },
        { name: "a trailing slash and trailing whitespace", base: "https://vault.bitwarden.eu/ " },
        { name: "all of the above", base: " Vault.Bitwarden.EU/ " },
      ])("still selects EU when base has $name", async ({ base }) => {
        const env = await applyPolicy({ base });

        expect(env.getRegion()).toBe(Region.EU);
        expect(env.isCloud()).toBe(true);
      });

      it("selects the region when only keys other than base are set and all of them match", async () => {
        const env = await applyPolicy({
          api: "https://api.bitwarden.eu",
          notifications: "https://notifications.bitwarden.eu",
        });

        expect(env.getRegion()).toBe(Region.EU);
        expect(env.isCloud()).toBe(true);
      });

      it("ignores keys that are set to an empty string", async () => {
        const env = await applyPolicy({ base: "https://vault.bitwarden.eu", icons: "" });

        expect(env.getRegion()).toBe(Region.EU);
      });

      it("uses the region's own urls instead of urls derived from base", async () => {
        const env = await applyPolicy({ base: "https://vault.bitwarden.eu" });

        expect(env.getNotificationsUrl()).toBe("https://notifications.bitwarden.eu");
        expect(env.getApiUrl()).toBe("https://api.bitwarden.eu");
      });
    });

    describe("managed urls that do not belong to a Bitwarden cloud region", () => {
      it("keeps a real self-hosted server as self-hosted", async () => {
        const env = await applyPolicy({ base: "https://bitwarden.mycompany.com" });

        expect(env.getRegion()).toBe(Region.SelfHosted);
        expect(env.getHostname()).toBe("bitwarden.mycompany.com");
        expect(env.isCloud()).toBe(false);
        expect(env.getUrls().base).toBe("https://bitwarden.mycompany.com");
      });

      it("keeps every managed url for a self-hosted server", async () => {
        const env = await applyPolicy({
          base: "https://bitwarden.mycompany.com",
          notifications: "https://notifications.mycompany.com",
        });

        expect(env.getRegion()).toBe(Region.SelfHosted);
        expect(env.getUrls().base).toBe("https://bitwarden.mycompany.com");
        expect(env.getUrls().notifications).toBe("https://notifications.mycompany.com");
      });

      it("stays self-hosted when one url points elsewhere, so a custom url is never dropped", async () => {
        const env = await applyPolicy({
          base: "https://vault.bitwarden.eu",
          icons: "https://icons.mycompany.com",
        });

        expect(env.getRegion()).toBe(Region.SelfHosted);
        expect(env.getUrls().base).toBe("https://vault.bitwarden.eu");
        expect(env.getUrls().icons).toBe("https://icons.mycompany.com");
      });

      it("stays self-hosted when notifications points at a different region", async () => {
        const env = await applyPolicy({
          base: "https://vault.bitwarden.eu",
          notifications: "https://notifications.bitwarden.com",
        });

        expect(env.getRegion()).toBe(Region.SelfHosted);
      });

      it("stays self-hosted when a url is only equivalent to the region's url", async () => {
        const env = await applyPolicy({
          base: "https://vault.bitwarden.eu",
          api: "https://vault.bitwarden.eu/api",
        });

        expect(env.getRegion()).toBe(Region.SelfHosted);
      });

      it("does not treat an insecure scheme as the cloud region", async () => {
        const env = await applyPolicy({ base: "http://vault.bitwarden.eu" });

        expect(env.getRegion()).toBe(Region.SelfHosted);
      });

      it("does not treat a look-alike host as the cloud region", async () => {
        const env = await applyPolicy({ base: "https://vault.bitwarden.eu.example.com" });

        expect(env.getRegion()).toBe(Region.SelfHosted);
        expect(env.isCloud()).toBe(false);
      });
    });

    it("keeps the existing behavior for a policy without any url", async () => {
      const env = await applyPolicy({});

      // Nothing to match and nothing to save as self-hosted, so the default region applies.
      expect(env.getRegion()).toBe(Region.US);
    });
  });
});
