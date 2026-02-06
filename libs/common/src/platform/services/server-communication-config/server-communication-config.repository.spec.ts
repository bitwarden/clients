import { ServerCommunicationConfig } from "@bitwarden/sdk-internal";

import { FakeAccountService, FakeStateProvider } from "../../../../spec";

import { ServerCommunicationConfigRepository } from "./server-communication-config.repository";

describe("ServerCommunicationConfigRepository", () => {
  let stateProvider: FakeStateProvider;
  let repository: ServerCommunicationConfigRepository;

  beforeEach(() => {
    const accountService = new FakeAccountService({});
    stateProvider = new FakeStateProvider(accountService);
    repository = new ServerCommunicationConfigRepository(stateProvider);
  });

  it("returns undefined when no config exists for hostname", async () => {
    const result = await repository.get("vault.acme.com");

    expect(result).toBeUndefined();
  });

  it("saves and retrieves a direct bootstrap config", async () => {
    const config: ServerCommunicationConfig = {
      bootstrap: { type: "direct" },
    };

    await repository.save("vault.acme.com", config);
    const result = await repository.get("vault.acme.com");

    expect(result).toEqual(config);
  });

  it("saves and retrieves an SSO cookie vendor config", async () => {
    const config: ServerCommunicationConfig = {
      bootstrap: {
        type: "ssoCookieVendor",
        idp_login_url: "https://idp.example.com/login",
        cookie_name: "auth_token",
        cookie_domain: ".acme.com",
        cookie_value: "abc123",
      },
    };

    await repository.save("vault.acme.com", config);
    const result = await repository.get("vault.acme.com");

    expect(result).toEqual(config);
  });

  it("handles SSO config with undefined cookie_value", async () => {
    const config: ServerCommunicationConfig = {
      bootstrap: {
        type: "ssoCookieVendor",
        idp_login_url: "https://idp.example.com/login",
        cookie_name: "auth_token",
        cookie_domain: ".acme.com",
        cookie_value: undefined,
      },
    };

    await repository.save("vault.acme.com", config);
    const result = await repository.get("vault.acme.com");

    expect(result).toEqual(config);
  });

  it("overwrites existing config for same hostname", async () => {
    const initialConfig: ServerCommunicationConfig = {
      bootstrap: { type: "direct" },
    };
    await repository.save("vault.acme.com", initialConfig);

    const newConfig: ServerCommunicationConfig = {
      bootstrap: {
        type: "ssoCookieVendor",
        idp_login_url: "https://idp.example.com",
        cookie_name: "token",
        cookie_domain: ".acme.com",
        cookie_value: "xyz789",
      },
    };
    await repository.save("vault.acme.com", newConfig);

    const result = await repository.get("vault.acme.com");
    expect(result).toEqual(newConfig);
  });

  it("maintains separate configs for different hostnames", async () => {
    const config1: ServerCommunicationConfig = {
      bootstrap: { type: "direct" },
    };
    const config2: ServerCommunicationConfig = {
      bootstrap: {
        type: "ssoCookieVendor",
        idp_login_url: "https://idp.example.com",
        cookie_name: "token",
        cookie_domain: ".example.com",
        cookie_value: "token123",
      },
    };

    await repository.save("vault1.acme.com", config1);
    await repository.save("vault2.example.com", config2);

    const result1 = await repository.get("vault1.acme.com");
    const result2 = await repository.get("vault2.example.com");

    expect(result1).toEqual(config1);
    expect(result2).toEqual(config2);
  });

  describe("get$", () => {
    it("emits undefined for hostname with no config", (done) => {
      repository.get$("vault.acme.com").subscribe((config) => {
        expect(config).toBeUndefined();
        done();
      });
    });

    it("emits config when it exists", async () => {
      const config: ServerCommunicationConfig = {
        bootstrap: { type: "direct" },
      };

      await repository.save("vault.acme.com", config);

      repository.get$("vault.acme.com").subscribe((result) => {
        expect(result).toEqual(config);
      });
    });

    it("emits new value when config changes", (done) => {
      const config1: ServerCommunicationConfig = {
        bootstrap: { type: "direct" },
      };
      const config2: ServerCommunicationConfig = {
        bootstrap: {
          type: "ssoCookieVendor",
          idp_login_url: "https://idp.example.com",
          cookie_name: "token",
          cookie_domain: ".acme.com",
          cookie_value: "abc123",
        },
      };

      const emissions: (ServerCommunicationConfig | undefined)[] = [];
      const subscription = repository.get$("vault.acme.com").subscribe((config) => {
        emissions.push(config);

        if (emissions.length === 3) {
          expect(emissions[0]).toBeUndefined();
          expect(emissions[1]).toEqual(config1);
          expect(emissions[2]).toEqual(config2);
          subscription.unsubscribe();
          done();
        }
      });

      // Trigger updates
      setTimeout(async () => {
        await repository.save("vault.acme.com", config1);
        setTimeout(async () => {
          await repository.save("vault.acme.com", config2);
        }, 10);
      }, 10);
    });

    it("only emits when the specific hostname config changes", (done) => {
      const config1: ServerCommunicationConfig = {
        bootstrap: { type: "direct" },
      };

      const emissions: (ServerCommunicationConfig | undefined)[] = [];
      const subscription = repository.get$("vault1.acme.com").subscribe((config) => {
        emissions.push(config);
      });

      setTimeout(async () => {
        // Save config for different hostname - should not trigger emission for vault1
        await repository.save("vault2.acme.com", config1);

        setTimeout(() => {
          // Only initial undefined emission should exist
          expect(emissions.length).toBe(1);
          expect(emissions[0]).toBeUndefined();
          subscription.unsubscribe();
          done();
        }, 50);
      }, 10);
    });
  });
});
