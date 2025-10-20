import { mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { newGuid } from "@bitwarden/guid";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { OrganizationId } from "../../../types/guid";

import { DefaultOrganizationMetadataService } from "./organization-metadata.service";

describe("DefaultOrganizationMetadataService", () => {
  let service: DefaultOrganizationMetadataService;
  let billingApiService: jest.Mocked<BillingApiServiceAbstraction>;
  let configService: jest.Mocked<ConfigService>;
  let featureFlagSubject: BehaviorSubject<boolean>;

  const mockOrganizationId = newGuid() as OrganizationId;
  const mockOrganizationId2 = newGuid() as OrganizationId;

  const createMockMetadataResponse = (
    isOnSecretsManagerStandalone = false,
    organizationOccupiedSeats = 5,
  ): OrganizationBillingMetadataResponse => {
    return {
      isOnSecretsManagerStandalone,
      organizationOccupiedSeats,
    } as OrganizationBillingMetadataResponse;
  };

  beforeEach(() => {
    billingApiService = mock<BillingApiServiceAbstraction>();
    configService = mock<ConfigService>();
    featureFlagSubject = new BehaviorSubject<boolean>(false);

    configService.getFeatureFlag$.mockReturnValue(featureFlagSubject.asObservable());

    service = new DefaultOrganizationMetadataService(billingApiService, configService);
  });

  afterEach(() => {
    jest.resetAllMocks();
    featureFlagSubject.complete();
  });

  describe("getOrganizationMetadata$", () => {
    describe("feature flag OFF", () => {
      beforeEach(() => {
        featureFlagSubject.next(false);
      });

      it("calls getOrganizationBillingMetadata when feature flag is off", async () => {
        const mockResponse = createMockMetadataResponse(false, 10);
        billingApiService.getOrganizationBillingMetadata.mockResolvedValue(mockResponse);

        const result = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));

        expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
          FeatureFlag.PM25379_UseNewOrganizationMetadataStructure,
        );
        expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledWith(
          mockOrganizationId,
        );
        expect(billingApiService.getOrganizationBillingMetadataVNext).not.toHaveBeenCalled();
        expect(result).toEqual(mockResponse);
      });

      it("does not cache metadata when feature flag is off", async () => {
        const mockResponse1 = createMockMetadataResponse(false, 10);
        const mockResponse2 = createMockMetadataResponse(false, 15);
        billingApiService.getOrganizationBillingMetadata
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        const result1 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));
        const result2 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));

        expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledTimes(2);
        expect(result1).toEqual(mockResponse1);
        expect(result2).toEqual(mockResponse2);
      });
    });

    describe("feature flag ON", () => {
      beforeEach(() => {
        featureFlagSubject.next(true);
      });

      it("calls getOrganizationBillingMetadataVNext when feature flag is on", async () => {
        const mockResponse = createMockMetadataResponse(true, 15);
        billingApiService.getOrganizationBillingMetadataVNext.mockResolvedValue(mockResponse);

        const result = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));

        expect(configService.getFeatureFlag$).toHaveBeenCalledWith(
          FeatureFlag.PM25379_UseNewOrganizationMetadataStructure,
        );
        expect(billingApiService.getOrganizationBillingMetadataVNext).toHaveBeenCalledWith(
          mockOrganizationId,
        );
        expect(billingApiService.getOrganizationBillingMetadata).not.toHaveBeenCalled();
        expect(result).toEqual(mockResponse);
      });

      it("caches metadata by organization ID when feature flag is on", async () => {
        const mockResponse = createMockMetadataResponse(true, 10);
        billingApiService.getOrganizationBillingMetadataVNext.mockResolvedValue(mockResponse);

        const result1 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));
        const result2 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));

        expect(billingApiService.getOrganizationBillingMetadataVNext).toHaveBeenCalledTimes(1);
        expect(result1).toEqual(mockResponse);
        expect(result2).toEqual(mockResponse);
      });

      it("maintains separate cache entries for different organization IDs", async () => {
        const mockResponse1 = createMockMetadataResponse(true, 10);
        const mockResponse2 = createMockMetadataResponse(false, 20);
        billingApiService.getOrganizationBillingMetadataVNext
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        const result1 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));
        const result2 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId2));
        const result3 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));
        const result4 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId2));

        expect(billingApiService.getOrganizationBillingMetadataVNext).toHaveBeenCalledTimes(2);
        expect(billingApiService.getOrganizationBillingMetadataVNext).toHaveBeenNthCalledWith(
          1,
          mockOrganizationId,
        );
        expect(billingApiService.getOrganizationBillingMetadataVNext).toHaveBeenNthCalledWith(
          2,
          mockOrganizationId2,
        );
        expect(result1).toEqual(mockResponse1);
        expect(result2).toEqual(mockResponse2);
        expect(result3).toEqual(mockResponse1);
        expect(result4).toEqual(mockResponse2);
      });
    });

    describe("shareReplay behavior", () => {
      beforeEach(() => {
        featureFlagSubject.next(true);
      });

      it("does not call API multiple times when the same cached observable is subscribed to multiple times", async () => {
        const mockResponse = createMockMetadataResponse(true, 10);
        billingApiService.getOrganizationBillingMetadataVNext.mockResolvedValue(mockResponse);

        const metadata$ = service.getOrganizationMetadata$(mockOrganizationId);

        const subscription1Promise = firstValueFrom(metadata$);
        const subscription2Promise = firstValueFrom(metadata$);
        const subscription3Promise = firstValueFrom(metadata$);

        const [result1, result2, result3] = await Promise.all([
          subscription1Promise,
          subscription2Promise,
          subscription3Promise,
        ]);

        expect(billingApiService.getOrganizationBillingMetadataVNext).toHaveBeenCalledTimes(1);
        expect(result1).toEqual(mockResponse);
        expect(result2).toEqual(mockResponse);
        expect(result3).toEqual(mockResponse);
      });
    });
  });

  describe("refreshMetadataCache", () => {
    beforeEach(() => {
      featureFlagSubject.next(true);
    });

    it("refreshes cached metadata when called with feature flag on", (done) => {
      const mockResponse1 = createMockMetadataResponse(true, 10);
      const mockResponse2 = createMockMetadataResponse(true, 20);
      let invocationCount = 0;

      billingApiService.getOrganizationBillingMetadataVNext
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const subscription = service.getOrganizationMetadata$(mockOrganizationId).subscribe({
        next: (result) => {
          invocationCount++;

          if (invocationCount === 1) {
            expect(result).toEqual(mockResponse1);
          } else if (invocationCount === 2) {
            expect(result).toEqual(mockResponse2);
            expect(billingApiService.getOrganizationBillingMetadataVNext).toHaveBeenCalledTimes(2);
            subscription.unsubscribe();
            done();
          }
        },
        error: done.fail,
      });

      setTimeout(() => {
        service.refreshMetadataCache();
      }, 10);
    });

    it("does not trigger refresh when feature flag is disabled", async () => {
      featureFlagSubject.next(false);

      const mockResponse1 = createMockMetadataResponse(false, 10);
      const mockResponse2 = createMockMetadataResponse(false, 20);
      let invocationCount = 0;

      billingApiService.getOrganizationBillingMetadata
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const subscription = service.getOrganizationMetadata$(mockOrganizationId).subscribe({
        next: () => {
          invocationCount++;
        },
      });

      // wait for initial invocation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(invocationCount).toBe(1);

      service.refreshMetadataCache();

      // wait to ensure no additional invocations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(invocationCount).toBe(1);
      expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledTimes(1);

      subscription.unsubscribe();
    });

    it("bypasses cache when refreshing metadata", (done) => {
      const mockResponse1 = createMockMetadataResponse(true, 10);
      const mockResponse2 = createMockMetadataResponse(true, 20);
      const mockResponse3 = createMockMetadataResponse(true, 30);
      let invocationCount = 0;

      billingApiService.getOrganizationBillingMetadataVNext
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)
        .mockResolvedValueOnce(mockResponse3);

      const subscription = service.getOrganizationMetadata$(mockOrganizationId).subscribe({
        next: (result) => {
          invocationCount++;

          if (invocationCount === 1) {
            expect(result).toEqual(mockResponse1);
            service.refreshMetadataCache();
          } else if (invocationCount === 2) {
            expect(result).toEqual(mockResponse2);
            service.refreshMetadataCache();
          } else if (invocationCount === 3) {
            expect(result).toEqual(mockResponse3);
            expect(billingApiService.getOrganizationBillingMetadataVNext).toHaveBeenCalledTimes(3);
            subscription.unsubscribe();
            done();
          }
        },
        error: done.fail,
      });
    });
  });
});
