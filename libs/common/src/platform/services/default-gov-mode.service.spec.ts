import { firstValueFrom, of } from "rxjs";

import { UserId } from "../../types/guid";
import { Region } from "../abstractions/environment.service";

import { DefaultGovModeService } from "./default-gov-mode.service";

describe("DefaultGovModeService", () => {
  const mockUserId = "00000000-0000-0000-0000-000000000001" as UserId;

  const createMockEnvironmentService = (region: Region) => ({
    globalEnvironment$: of({
      getRegion: () => region,
    }),
    getEnvironment$: (_userId: UserId) =>
      of({
        getRegion: () => region,
      }),
  });

  describe("globalIsGovMode$", () => {
    it("emits true for Gov", async () => {
      const envService = createMockEnvironmentService(Region.Gov);
      const sut = new DefaultGovModeService(envService as any);

      const result = await firstValueFrom(sut.globalIsGovMode$);

      expect(result).toBe(true);
    });

    it.each([Region.US, Region.EU, Region.SelfHosted])("emits false for %s", async (region) => {
      const envService = createMockEnvironmentService(region);
      const sut = new DefaultGovModeService(envService as any);

      const result = await firstValueFrom(sut.globalIsGovMode$);

      expect(result).toBe(false);
    });
  });

  describe("isGovMode$", () => {
    it("emits true for Gov", async () => {
      const envService = createMockEnvironmentService(Region.Gov);
      const sut = new DefaultGovModeService(envService as any);

      const result = await firstValueFrom(sut.isGovMode$(mockUserId));

      expect(result).toBe(true);
    });

    it.each([Region.US, Region.EU, Region.SelfHosted])("emits false for %s", async (region) => {
      const envService = createMockEnvironmentService(region);
      const sut = new DefaultGovModeService(envService as any);

      const result = await firstValueFrom(sut.isGovMode$(mockUserId));

      expect(result).toBe(false);
    });
  });
});
