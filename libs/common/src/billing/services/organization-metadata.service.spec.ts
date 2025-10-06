import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { OrganizationBillingMetadataResponse } from "@bitwarden/common/billing/models/response/organization-billing-metadata.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { newGuid } from "@bitwarden/guid";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { OrganizationId } from "../../types/guid";

import { DefaultOrganizationMetadataService } from "./organization-metadata.service";

describe("DefaultOrganizationMetadataService", () => {
  let service: DefaultOrganizationMetadataService;
  let billingApiService: jest.Mocked<BillingApiServiceAbstraction>;
  let configService: jest.Mocked<ConfigService>;

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

    service = new DefaultOrganizationMetadataService(billingApiService, configService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getOrganizationMetadata$", () => {
    describe("feature flag OFF", () => {
      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(false);
      });

      it("calls getOrganizationBillingMetadata when feature flag is off", async () => {
        const mockResponse = createMockMetadataResponse(false, 10);
        billingApiService.getOrganizationBillingMetadata.mockResolvedValue(mockResponse);

        const result = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));

        expect(configService.getFeatureFlag).toHaveBeenCalledWith(
          FeatureFlag.PM25379_UseNewOrganizationMetadataStructure,
        );
        expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledWith(
          mockOrganizationId,
        );
        expect(billingApiService.getOrganizationBillingMetadataVNext).not.toHaveBeenCalled();
        expect(result).toEqual(mockResponse);
      });
    });

    describe("feature flag ON", () => {
      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(true);
      });

      it("calls getOrganizationBillingMetadataVNext when feature flag is on", async () => {
        const mockResponse = createMockMetadataResponse(true, 15);
        billingApiService.getOrganizationBillingMetadataVNext.mockResolvedValue(mockResponse);

        const result = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));

        expect(configService.getFeatureFlag).toHaveBeenCalledWith(
          FeatureFlag.PM25379_UseNewOrganizationMetadataStructure,
        );
        expect(billingApiService.getOrganizationBillingMetadataVNext).toHaveBeenCalledWith(
          mockOrganizationId,
        );
        expect(billingApiService.getOrganizationBillingMetadata).not.toHaveBeenCalled();
        expect(result).toEqual(mockResponse);
      });
    });

    describe("cache behavior", () => {
      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(false);
      });

      it("caches metadata by organization ID", async () => {
        const mockResponse = createMockMetadataResponse(false, 10);
        billingApiService.getOrganizationBillingMetadata.mockResolvedValue(mockResponse);

        const result1 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));
        const result2 = await firstValueFrom(service.getOrganizationMetadata$(mockOrganizationId));

        expect(billingApiService.getOrganizationBillingMetadata).toHaveBeenCalledTimes(1);
        expect(result1).toEqual(mockResponse);
        expect(result2).toEqual(mockResponse);
      });

      it("maintains separate cache entries for different organization IDs", async () => {
        const mockResponse1 = createMockMetadataResponse(false, 10);
        const mockResponse2 = createMockMetadataResponse(true, 20);
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
    });

    describe("shareReplay behavior", () => {
      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(false);
      });

      it("does not call API multiple times when the same cached observable is subscribed to multiple times", async () => {
        const mockResponse = createMockMetadataResponse(false, 10);
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
  });
});
