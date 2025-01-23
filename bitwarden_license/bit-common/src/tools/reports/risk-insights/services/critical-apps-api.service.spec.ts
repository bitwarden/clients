import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import {
  PasswordHealthReportApplicationDropRequest,
  PasswordHealthReportApplicationId,
  PasswordHealthReportApplicationsRequest,
  PasswordHealthReportApplicationsResponse,
} from "../models/password-health";

import { CriticalAppsApiService } from "./critical-apps-api.service";

describe("CriticalAppsApiService", () => {
  let service: CriticalAppsApiService;
  const apiService = mock<ApiService>();

  beforeEach(() => {
    service = new CriticalAppsApiService(apiService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should call apiService.send with correct parameters for SaveCriticalApps", (done) => {
    const requests: PasswordHealthReportApplicationsRequest[] = [
      { organizationId: "org1" as OrganizationId, url: "test one" },
      { organizationId: "org1" as OrganizationId, url: "test two" },
    ];
    const response: PasswordHealthReportApplicationsResponse[] = [
      {
        id: "1" as PasswordHealthReportApplicationId,
        organizationId: "org1" as OrganizationId,
        uri: "test one",
      },
      {
        id: "2" as PasswordHealthReportApplicationId,
        organizationId: "org1" as OrganizationId,
        uri: "test two",
      },
    ];

    apiService.send.mockReturnValue(Promise.resolve(response));

    service.saveCriticalApps(requests).subscribe((result) => {
      expect(result).toEqual(response);
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/reports/password-health-report-applications/",
        requests,
        true,
        true,
      );
      done();
    });
  });

  it("should call apiService.send with correct parameters for GetCriticalApps", (done) => {
    const orgId: OrganizationId = "org1" as OrganizationId;
    const response: PasswordHealthReportApplicationsResponse[] = [
      { id: "1" as PasswordHealthReportApplicationId, organizationId: orgId, uri: "test one" },
      { id: "2" as PasswordHealthReportApplicationId, organizationId: orgId, uri: "test two" },
    ];

    apiService.send.mockReturnValue(Promise.resolve(response));

    service.getCriticalApps(orgId).subscribe((result) => {
      expect(result).toEqual(response);
      expect(apiService.send).toHaveBeenCalledWith(
        "GET",
        `/reports/password-health-report-applications/${orgId.toString()}`,
        null,
        true,
        true,
      );
      done();
    });
  });

  it("should call apiService.send with correct parameters for DropCriticalApp", (done) => {
    const request: PasswordHealthReportApplicationDropRequest = {
      organizationId: "org1" as OrganizationId,
      passwordHealthReportApplicationIds: ["123"],
    };

    apiService.send.mockReturnValue(Promise.resolve());

    service.dropCriticalApp(request).subscribe(() => {
      expect(apiService.send).toHaveBeenCalledWith(
        "DELETE",
        "/reports/password-health-report-application/",
        request,
        true,
        true,
      );
      done();
    });
  });
});
