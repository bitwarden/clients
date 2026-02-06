import { firstValueFrom } from "rxjs";

import { ServerCommunicationConfig } from "@bitwarden/sdk-internal";

import { awaitAsync, FakeAccountService, FakeStateProvider } from "../../../../spec";

import { DefaultServerCommunicationConfigService } from "./default-server-communication-config.service";
import { ServerCommunicationConfigRepository } from "./server-communication-config.repository";

// Mock SDK client
jest.mock("@bitwarden/sdk-internal", () => ({
  ServerCommunicationConfigClient: jest.fn().mockImplementation(() => ({
    needsBootstrap: jest.fn(),
    cookies: jest.fn(),
    getConfig: jest.fn(),
  })),
}));

describe("DefaultServerCommunicationConfigService", () => {
  let stateProvider: FakeStateProvider;
  let repository: ServerCommunicationConfigRepository;
  let service: DefaultServerCommunicationConfigService;
  let mockClient: any;

  beforeEach(() => {
    const accountService = new FakeAccountService({});
    stateProvider = new FakeStateProvider(accountService);
    repository = new ServerCommunicationConfigRepository(stateProvider);
    service = new DefaultServerCommunicationConfigService(repository);
    mockClient = (service as any).client;
  });

  describe("needsBootstrap$", () => {
    it("emits false when direct bootstrap configured", async () => {
      mockClient.needsBootstrap.mockResolvedValue(false);

      const result = await firstValueFrom(service.needsBootstrap$("vault.bitwarden.com"));

      expect(result).toBe(false);
      expect(mockClient.needsBootstrap).toHaveBeenCalledWith("vault.bitwarden.com");
    });

    it("emits true when SSO cookie vendor bootstrap needed", async () => {
      mockClient.needsBootstrap.mockResolvedValue(true);

      const result = await firstValueFrom(service.needsBootstrap$("vault.acme.com"));

      expect(result).toBe(true);
      expect(mockClient.needsBootstrap).toHaveBeenCalledWith("vault.acme.com");
    });

    it("re-emits when config state changes", async () => {
      mockClient.needsBootstrap.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const observable = service.needsBootstrap$("vault.bitwarden.com");
      const emissions: boolean[] = [];

      // Subscribe to collect emissions
      const subscription = observable.subscribe((value) => emissions.push(value));

      // Wait for first emission
      await awaitAsync();
      expect(emissions[0]).toBe(false);

      // Update config state to trigger re-check
      const config: ServerCommunicationConfig = {
        bootstrap: { type: "direct" },
      };
      await repository.save("vault.bitwarden.com", config);

      // Wait for second emission
      await awaitAsync();
      expect(emissions[1]).toBe(true);

      subscription.unsubscribe();
    });

    it("creates independent observables per hostname", async () => {
      mockClient.needsBootstrap.mockImplementation(async (hostname: string) => {
        return hostname === "vault1.acme.com";
      });

      const result1 = await firstValueFrom(service.needsBootstrap$("vault1.acme.com"));
      const result2 = await firstValueFrom(service.needsBootstrap$("vault2.acme.com"));

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(mockClient.needsBootstrap).toHaveBeenCalledWith("vault1.acme.com");
      expect(mockClient.needsBootstrap).toHaveBeenCalledWith("vault2.acme.com");
    });

    it("shares result between simultaneous subscribers", async () => {
      mockClient.needsBootstrap.mockResolvedValue(true);

      const observable = service.needsBootstrap$("vault.bitwarden.com");

      // Multiple simultaneous subscribers should share the same call
      const [result1, result2] = await Promise.all([
        firstValueFrom(observable),
        firstValueFrom(observable),
      ]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      // Should only call once for simultaneous subscribers
      expect(mockClient.needsBootstrap).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCookies", () => {
    it("retrieves cookies for hostname", async () => {
      const expectedCookies: Array<[string, string]> = [
        ["auth_token", "abc123"],
        ["session_id", "xyz789"],
      ];
      mockClient.cookies.mockResolvedValue(expectedCookies);

      const result = await service.getCookies("vault.bitwarden.com");

      expect(result).toEqual(expectedCookies);
      expect(mockClient.cookies).toHaveBeenCalledWith("vault.bitwarden.com");
    });

    it("returns empty array when no cookies configured", async () => {
      mockClient.cookies.mockResolvedValue([]);

      const result = await service.getCookies("vault.bitwarden.com");

      expect(result).toEqual([]);
      expect(mockClient.cookies).toHaveBeenCalledWith("vault.bitwarden.com");
    });

    it("handles different hostnames independently", async () => {
      mockClient.cookies
        .mockResolvedValueOnce([["cookie1", "value1"]])
        .mockResolvedValueOnce([["cookie2", "value2"]]);

      const result1 = await service.getCookies("vault1.acme.com");
      const result2 = await service.getCookies("vault2.acme.com");

      expect(result1).toEqual([["cookie1", "value1"]]);
      expect(result2).toEqual([["cookie2", "value2"]]);
      expect(mockClient.cookies).toHaveBeenCalledTimes(2);
    });
  });
});
