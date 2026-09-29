import { firstValueFrom } from "rxjs";

import { ManagementProfile } from "@bitwarden/sdk-internal";

import { DevManagedSettingsService } from "./dev-managed-settings.service";

jest.mock("@bitwarden/sdk-internal", () => ({
  ManagedSettingsClient: jest.fn().mockImplementation(() => ({
    update_profile: jest.fn(),
  })),
}));

describe("DevManagedSettingsService", () => {
  let service: DevManagedSettingsService;

  beforeEach(() => {
    service = new DevManagedSettingsService(Promise.resolve());
  });

  it("makes a nested source readable under its dotted key, JSON-encoded", () => {
    service.pushExplicit({ environment: { base: "https://localhost:8080" } });

    expect(service.get("environment.base")).toBe('"https://localhost:8080"');
  });

  it("reports a pushed key as managed", () => {
    service.pushExplicit({ environment: { base: "https://localhost:8080" } });

    expect(service.isManaged("environment.base")).toBe(true);
  });

  it("replaces the previously pushed source", () => {
    service.pushExplicit({ environment: { base: "https://localhost:8080" } });
    service.pushExplicit({ generator: { password: { length: 20 } } });

    expect(service.get("environment.base")).toBeUndefined();
    expect(service.get("generator.password.length")).toBe("20");
  });

  it("emits the new value to an existing get$ subscriber", async () => {
    const emissions: (string | undefined)[] = [];
    const subscription = service.get$("environment.base").subscribe((v) => emissions.push(v));

    service.pushExplicit({ environment: { base: "https://localhost:8080" } });
    subscription.unsubscribe();

    expect(emissions).toEqual([undefined, '"https://localhost:8080"']);
  });

  it("mirrors the pushed source into the SDK handle", async () => {
    service.pushExplicit({ environment: { base: "https://localhost:8080" } });

    const client = await firstValueFrom(service.client$);

    expect(client.update_profile).toHaveBeenLastCalledWith(
      expect.objectContaining({
        settings: new Map([["environment.base", '"https://localhost:8080"']]),
      }),
    );
  });

  // The dev source does not shield itself from host acquisition; a client that runs both must skip
  // its host reader instead.
  it("lets a host profile replace a pushed source", () => {
    service.pushExplicit({ environment: { base: "https://localhost:8080" } });

    const hostProfile: ManagementProfile = {
      version: 1,
      updatedAt: 1000,
      settings: new Map([["environment.base", '"https://vault.example.com"']]),
    };
    service.updateProfile(hostProfile);

    expect(service.get("environment.base")).toBe('"https://vault.example.com"');
  });
});
