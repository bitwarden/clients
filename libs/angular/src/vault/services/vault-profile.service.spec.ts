import { TestBed } from "@angular/core/testing";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { VaultProfileService } from "./vault-profile.service";

describe("VaultProfileService", () => {
  let service: VaultProfileService;
  const hardcodedDateString = "2024-02-24T12:00:00Z";

  const getProfile = jest.fn().mockResolvedValue({ creationDate: hardcodedDateString });

  beforeEach(() => {
    getProfile.mockClear();

    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: { getProfile } }],
    });

    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-02-22T00:00:00Z"));
    service = TestBed.runInInjectionContext(() => new VaultProfileService());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls `getProfile` when stored profile date is not set", async () => {
    expect(service["profileCreatedDate"]).toBeNull();

    const date = await service.getProfileCreationDate();

    expect(date.toISOString()).toBe("2024-02-24T12:00:00.000Z");
    expect(getProfile).toHaveBeenCalled();
  });

  it("does not call `getProfile` when the date is already stored", async () => {
    service["profileCreatedDate"] = hardcodedDateString;

    const date = await service.getProfileCreationDate();

    expect(date.toISOString()).toBe("2024-02-24T12:00:00.000Z");
    expect(getProfile).not.toHaveBeenCalled();
  });
});
