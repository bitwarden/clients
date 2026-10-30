import { mock } from "jest-mock-extended";

import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import type {
  CryptoClient,
  ManagedSettingsClient,
  PasswordManagerClient,
} from "@bitwarden/sdk-internal";

import { BrowserForegroundSdkClientFactory } from "./browser-foreground-sdk-client-factory";

describe("BrowserForegroundSdkClientFactory", () => {
  it("disables local unlock migrations on created clients", async () => {
    const crypto = mock<CryptoClient>();
    const client = mock<PasswordManagerClient>();
    client.crypto.mockReturnValue(crypto);
    const inner = mock<SdkClientFactory>();
    inner.createSdkClient.mockResolvedValue(client);

    const created = await new BrowserForegroundSdkClientFactory(inner).createSdkClient(
      undefined,
      undefined,
      mock<ManagedSettingsClient>(),
    );

    expect(created).toBe(client);
    expect(crypto.disable_local_unlock_migrations).toHaveBeenCalledTimes(1);
  });
});
