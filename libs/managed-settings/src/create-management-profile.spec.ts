import { createManagementProfile } from "./create-management-profile";
import { MANAGEMENT_PROFILE_VERSION } from "./management-profile-version";

describe("createManagementProfile", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("stamps the current schema version", () => {
    expect(createManagementProfile({}).version).toBe(MANAGEMENT_PROFILE_VERSION);
  });

  it("stamps updatedAt in seconds", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-01T00:00:00.000Z"));

    expect(createManagementProfile({}).updatedAt).toBe(1788220800);
  });

  it("flattens the source into dotted keys with JSON-encoded values", () => {
    const profile = createManagementProfile({
      environment: { base: "https://vault.example.com" },
    });

    expect(profile.settings).toEqual(
      new Map([["environment.base", '"https://vault.example.com"']]),
    );
  });

  it("returns an empty settings map for an empty source", () => {
    expect(createManagementProfile({}).settings).toEqual(new Map());
  });
});
