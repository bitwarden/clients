import { firstValueFrom } from "rxjs";

import { DevManagedSettingsService } from "./dev-managed-settings.service";

const mockUpdateFromJson = jest.fn().mockResolvedValue(undefined);

jest.mock("@bitwarden/sdk-internal", () => ({
  ManagedSettingsClient: jest.fn().mockImplementation(() => ({
    update_from_json: mockUpdateFromJson,
    on_profile_changed: jest.fn(),
  })),
}));

describe("DevManagedSettingsService", () => {
  let service: DevManagedSettingsService;

  beforeEach(() => {
    mockUpdateFromJson.mockClear();
    service = new DevManagedSettingsService(Promise.resolve());
  });

  it("passes the nested source to the SDK handle as JSON", async () => {
    await service.pushExplicit({ environment: { base: "https://localhost:8080" } });

    const client = await firstValueFrom(service.client$);
    expect(client.update_from_json).toHaveBeenCalledWith(
      '{"environment":{"base":"https://localhost:8080"}}',
    );
  });

  it("waits for the SDK before passing the source", async () => {
    let markSdkReady: () => void = () => {};
    const pending = new DevManagedSettingsService(
      new Promise<void>((resolve) => (markSdkReady = resolve)),
    );

    const pushed = pending.pushExplicit({ environment: { base: "https://localhost:8080" } });
    await Promise.resolve();
    expect(mockUpdateFromJson).not.toHaveBeenCalled();

    markSdkReady();
    await pushed;

    expect(mockUpdateFromJson).toHaveBeenCalledTimes(1);
  });
});
