import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { newGuid } from "@bitwarden/guid";

import { OrganizationId } from "../../../types/guid";

import { DefaultOrganizationMetadataService } from "./organization-metadata.service";

describe("DefaultOrganizationMetadataService", () => {
  let service: DefaultOrganizationMetadataService;
  let billingApiService: jest.Mocked<BillingApiServiceAbstraction>;
  let platformUtilsService: jest.Mocked<PlatformUtilsService>;

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
    platformUtilsService = mock<PlatformUtilsService>();

    platformUtilsService.isSelfHost.mockReturnValue(false);

    service = new DefaultOrganizationMetadataService(billingApiService, platformUtilsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getOrganizationMetadata$", () => {
    it("calls getOrganizationBillingMetadata for cloud-hosted", async () => {
      const mockResponse = createMockMetadataResponse(false, 10);
      billingApiService.getOrganizationBillingMetadata.mockResolvedValue(mockResponse);

      const result = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));

      expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledWith(
        mockOrganizationId,
      );
      expect(result).toEqual(mockResponse);
    });

    it("calls getOrganizationBillingMetadataSelfHost when isSelfHost is true", async () => {
      platformUtilsService.isSelfHost.mockReturnValue(true);
      const mockResponse = createMockMetadataResponse(true, 25);
      billingApiService.getOrganizationBillingMetadataSelfHost.mockResolvedValue(mockResponse);

      const result = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));

      expect(platformUtilsService.isSelfHost).toHaveBeenCalled();
      expect(billingApiService.getOrganizationBillingMetadataSelfHost).toHaveBeenCalledWith(
        mockOrganizationId,
      );
      expect(billingApiService.getOrganizationBillingMetadata).not.toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it("caches metadata by organization ID", async () => {
      const mockResponse = createMockMetadataResponse(true, 10);
      billingApiService.getOrganizationBillingMetadata.mockResolvedValue(mockResponse);

      const result1 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));
      const result2 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));

      expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockResponse);
      expect(result2).toEqual(mockResponse);
    });

    it("maintains separate cache entries for different organization IDs", async () => {
      const mockResponse1 = createMockMetadataResponse(true, 10);
      const mockResponse2 = createMockMetadataResponse(false, 20);
      billingApiService.getOrganizationBillingMetadata
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const result1 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));
      const result2 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId2));
      const result3 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));
      const result4 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId2));

      expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledTimes(2);
      expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenNthCalledWith(
        1,
        mockOrganizationId,
      );
      expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenNthCalledWith(
        2,
        mockOrganizationId2,
      );
      expect(result1).toEqual(mockResponse1);
      expect(result2).toEqual(mockResponse2);
      expect(result3).toEqual(mockResponse1);
      expect(result4).toEqual(mockResponse2);
    });

    it("does not call API multiple times when the same cached observable is subscribed to multiple times", async () => {
      const mockResponse = createMockMetadataResponse(true, 10);
      billingApiService.getOrganizationBillingMetadata.mockResolvedValue(mockResponse);

      const metadata$ = service.getOrganizationMetadata$(mockOrganizationId);

      const subscription1Promise = firstValueFrom(metadata$);
      const subscription2Promise = firstValueFrom(metadata$);
      const subscription3Promise = firstValueFrom(metadata$);

      const [result1, result2, result3] = await Promise.all([
        subscription1Promise,
        subscription2Promise,
        subscription3Promise,
      ]);

      expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockResponse);
      expect(result2).toEqual(mockResponse);
      expect(result3).toEqual(mockResponse);
    });
  });

  describe("refreshMetadataCache", () => {
    it("refreshes cached metadata when called", (done) => {
      const mockResponse1 = createMockMetadataResponse(true, 10);
      const mockResponse2 = createMockMetadataResponse(true, 20);
      let invocationCount = 0;

      billingApiService.getOrganizationBillingMetadata
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const subscription = service.getOrganizationMetadata$(mockOrganizationId).subscribe({
        next: (result) => {
          invocationCount++;

          if (invocationCount === 1) {
            expect(result).toEqual(mockResponse1);
          } else if (invocationCount === 2) {
            expect(result).toEqual(mockResponse2);
            expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledTimes(2);
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

    it("bypasses cache when refreshing metadata", (done) => {
      const mockResponse1 = createMockMetadataResponse(true, 10);
      const mockResponse2 = createMockMetadataResponse(true, 20);
      const mockResponse3 = createMockMetadataResponse(true, 30);
      let invocationCount = 0;

      billingApiService.getOrganizationBillingMetadata
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
            expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledTimes(3);
            subscription.unsubscribe();
            done();
          }
        },
        error: done.fail,
      });
    });
  });
});
