import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, take, toArray } from "rxjs";

import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { mockManagedSettingsService } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ManagedSettingsService } from "@bitwarden/managed-settings";
import { PasswordManagerClient, TokenProvider } from "@bitwarden/sdk-internal";

import { MainSdkService } from "./main-sdk.service";

class TestSdkLoadService extends SdkLoadService {
  protected override load(): Promise<void> {
    return Promise.resolve();
  }
}

function mockEnvironment(apiUrl: string, identityUrl: string): Environment {
  return mock<Environment>({
    getApiUrl: () => apiUrl,
    getIdentityUrl: () => identityUrl,
  });
}

const unsupportedMessage = "User SDK clients are not available in the main process";

describe("MainSdkService", () => {
  const userId = "00000000-0000-0000-0000-000000000001" as UserId;

  let sdkClientFactory: MockProxy<SdkClientFactory>;
  let environmentService: MockProxy<EnvironmentService>;
  let managedSettingsService: MockProxy<ManagedSettingsService>;
  let environment$: BehaviorSubject<Environment>;
  let service: MainSdkService;

  beforeEach(async () => {
    await new TestSdkLoadService().loadAndInit();

    sdkClientFactory = mock<SdkClientFactory>();
    environmentService = mock<EnvironmentService>();
    managedSettingsService = mockManagedSettingsService();

    // Assigned after construction: `mock()` would otherwise proxy the observable itself.
    environment$ = new BehaviorSubject(
      mockEnvironment("https://api.example.com", "https://identity.example.com"),
    );
    environmentService.environment$ = environment$;

    service = new MainSdkService(sdkClientFactory, environmentService, managedSettingsService);
  });

  describe("client$", () => {
    it("creates a client with the URLs of the current environment", async () => {
      const client = mock<PasswordManagerClient>();
      sdkClientFactory.createSdkClient.mockResolvedValue(client);

      const result = await firstValueFrom(service.client$);

      expect(result).toBe(client);
      expect(sdkClientFactory.createSdkClient.mock.calls[0][1]).toEqual({
        apiUrl: "https://api.example.com",
        identityUrl: "https://identity.example.com",
      });
    });

    it("passes the managed settings client to the SDK client", async () => {
      sdkClientFactory.createSdkClient.mockResolvedValue(mock<PasswordManagerClient>());
      const managedSettingsClient = await firstValueFrom(managedSettingsService.client$);

      await firstValueFrom(service.client$);

      // Compared by reference: a mock proxy answers `asymmetricMatch`, so Jest's argument
      // matchers mistake it for a matcher.
      expect(sdkClientFactory.createSdkClient.mock.calls[0][2]).toBe(managedSettingsClient);
    });

    it("creates the client without an access token", async () => {
      sdkClientFactory.createSdkClient.mockResolvedValue(mock<PasswordManagerClient>());

      await firstValueFrom(service.client$);

      const tokenProvider: TokenProvider = sdkClientFactory.createSdkClient.mock.calls[0][0];
      await expect(tokenProvider.get_access_token()).resolves.toBeUndefined();
    });

    it("shares one client between concurrent subscribers", async () => {
      sdkClientFactory.createSdkClient.mockResolvedValue(mock<PasswordManagerClient>());

      const [first, second] = await Promise.all([
        firstValueFrom(service.client$),
        firstValueFrom(service.client$),
      ]);

      expect(first).toBe(second);
      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(1);
    });

    it("creates a new client when the environment changes", async () => {
      const firstClient = mock<PasswordManagerClient>();
      const secondClient = mock<PasswordManagerClient>();
      sdkClientFactory.createSdkClient
        .mockResolvedValueOnce(firstClient)
        .mockResolvedValueOnce(secondClient);

      const clients = firstValueFrom(service.client$.pipe(take(2), toArray()));
      environment$.next(mockEnvironment("https://api.other.com", "https://identity.other.com"));

      const [first, second] = await clients;
      expect(first).toBe(firstClient);
      expect(second).toBe(secondClient);
      expect(sdkClientFactory.createSdkClient).toHaveBeenCalledTimes(2);
      expect(sdkClientFactory.createSdkClient.mock.calls[1][1]).toEqual({
        apiUrl: "https://api.other.com",
        identityUrl: "https://identity.other.com",
      });
    });
  });

  describe("version$", () => {
    it("emits the version of the client", async () => {
      const client = mock<PasswordManagerClient>();
      client.version.mockReturnValue("1.2.3");
      sdkClientFactory.createSdkClient.mockResolvedValue(client);

      await expect(firstValueFrom(service.version$)).resolves.toBe("1.2.3");
    });
  });

  describe("user clients", () => {
    it("userClient$ errors through the observable instead of throwing", async () => {
      expect(() => service.userClient$(userId)).not.toThrow();
      await expect(firstValueFrom(service.userClient$(userId))).rejects.toThrow(unsupportedMessage);
    });

    it("unlock rejects", async () => {
      await expect(service.unlock()).rejects.toThrow(unsupportedMessage);
    });

    it("lock rejects", async () => {
      await expect(service.lock(userId)).rejects.toThrow(unsupportedMessage);
    });

    it("setFlags rejects", async () => {
      await expect(service.setFlags(userId, new Map())).rejects.toThrow(unsupportedMessage);
    });

    it("setOrgKeys rejects", async () => {
      await expect(service.setOrgKeys(userId, {})).rejects.toThrow(unsupportedMessage);
    });

    it("logout throws", () => {
      expect(() => service.logout(userId)).toThrow(unsupportedMessage);
    });
  });
});
