import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { ApiService } from "../../../../abstractions/api.service";
import { FeatureFlag } from "../../../../enums/feature-flag.enum";
import { ConfigService } from "../../../../platform/abstractions/config/config.service";
import { CipherId, UserId } from "../../../../types/guid";
import { CipherService } from "../../../../vault/abstractions/cipher.service";
import { CipherData } from "../../../../vault/models/data/cipher.data";

import { DefaultCipherReportExclusionService } from "./default-cipher-report-exclusion.service";

describe("DefaultCipherReportExclusionService", () => {
  const userId = "user-1" as UserId;
  const excludedId = "cipher-excluded" as CipherId;
  const otherId = "cipher-other" as CipherId;

  let apiService: ReturnType<typeof mock<ApiService>>;
  let cipherService: ReturnType<typeof mock<CipherService>>;
  let configService: ReturnType<typeof mock<ConfigService>>;
  let ciphers$: BehaviorSubject<Record<CipherId, CipherData>>;
  let flag$: BehaviorSubject<boolean>;
  let service: DefaultCipherReportExclusionService;

  const cipherData = (id: CipherId, excludedFromReports?: boolean) =>
    Object.assign(new CipherData(), { id, excludedFromReports });

  beforeEach(() => {
    apiService = mock<ApiService>();
    cipherService = mock<CipherService>();
    configService = mock<ConfigService>();
    ciphers$ = new BehaviorSubject<Record<CipherId, CipherData>>({
      [excludedId]: cipherData(excludedId, true),
      [otherId]: cipherData(otherId),
    });
    flag$ = new BehaviorSubject(true);
    cipherService.ciphers$.mockReturnValue(ciphers$);
    configService.getFeatureFlag$.mockImplementation((flag) =>
      flag === FeatureFlag.HealthReportExclusions ? flag$ : new BehaviorSubject(false),
    );
    service = new DefaultCipherReportExclusionService(apiService, cipherService, configService);
  });

  describe("excludedCipherIds$", () => {
    it("emits the ids of ciphers excluded from reports", async () => {
      const ids = await firstValueFrom(service.excludedCipherIds$(userId));

      expect([...ids]).toEqual([excludedId]);
    });

    it("does not re-emit when an unrelated cipher changes", () => {
      const emissions: ReadonlySet<string>[] = [];
      const subscription = service
        .excludedCipherIds$(userId)
        .subscribe((ids) => emissions.push(ids));

      ciphers$.next({
        [excludedId]: cipherData(excludedId, true),
        [otherId]: Object.assign(cipherData(otherId), { favorite: true }),
      });
      subscription.unsubscribe();

      expect(emissions).toHaveLength(1);
    });

    it("emits an empty set while the exclusions flag is off", async () => {
      flag$.next(false);

      const ids = await firstValueFrom(service.excludedCipherIds$(userId));

      expect(ids.size).toBe(0);
    });
  });

  describe("excludeWithServer", () => {
    it("sends PUT /ciphers/{id}/exclude-from-reports, then upserts the cipher with excludedFromReports", async () => {
      await service.excludeWithServer(otherId, userId);

      expect(apiService.send).toHaveBeenCalledWith(
        "PUT",
        `/ciphers/${otherId}/exclude-from-reports`,
        null,
        true,
        false,
      );
      expect(cipherService.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: otherId, excludedFromReports: true }),
        userId,
      );
    });

    it("does not touch local state when the request fails", async () => {
      apiService.send.mockRejectedValue(
        new Error("Premium required to exclude items from reports."),
      );

      await expect(service.excludeWithServer(otherId, userId)).rejects.toThrow();

      expect(cipherService.upsert).not.toHaveBeenCalled();
    });
  });
});
