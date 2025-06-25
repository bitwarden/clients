import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { SaveRiskInsightsReportRequest } from "../models/password-health";

import { RiskInsightsApiService } from "./risk-insights-api.service";

describe("RiskInsightsApiService", () => {
  let service: RiskInsightsApiService;
  const apiService = mock<ApiService>();

  beforeEach(() => {
    service = new RiskInsightsApiService(apiService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should call apiService.send with correct parameters for saveRiskInsightsReport", (done) => {
    const orgId = "org1" as OrganizationId;
    const request: SaveRiskInsightsReportRequest = {
      data: {
        organizationId: orgId,
        date: new Date().toISOString(),
        reportData: "test",
        reportKey: "test-key",
      },
    };
    const response = {
      ...request.data,
    };

    apiService.send.mockReturnValue(Promise.resolve(response));

    service.saveRiskInsightsReport(request).subscribe((result) => {
      expect(result).toEqual(response);
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        `/reports/organization-reports`,
        request.data,
        true,
        true,
      );
      done();
    });
  });
});
