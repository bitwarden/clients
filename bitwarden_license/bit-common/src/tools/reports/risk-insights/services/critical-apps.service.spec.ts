import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import {
  CriticalAppsService,
  PasswordHealthReportApplicationsRequest,
  PasswordHealthReportApplicationsResponse,
} from "./critical-apps.service";

describe("CriticaAppsService", () => {
  let service: CriticalAppsService;
  const apiService = mock<ApiService>();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CriticalAppsService, { provide: ApiService, useValue: apiService }],
    });
    service = TestBed.inject(CriticalAppsService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should set critical apps", async () => {
    const criticalApps = [
      { organizationId: "org1", url: "https://example.com" },
      { organizationId: "org2", url: "https://example.org" },
    ] as PasswordHealthReportApplicationsRequest[];

    const response = [
      { id: "id1", organizationId: "org1", uri: "https://example.com" },
      { id: "id2", organizationId: "org2", uri: "https://example.org" },
    ] as PasswordHealthReportApplicationsResponse[];

    apiService.send.mockResolvedValue(response);
    await service.setCriticalApps(criticalApps);

    expect(apiService.send).toHaveBeenCalledWith(
      "POST",
      "/reports/password-health-report-applications/",
      criticalApps,
      true,
      true,
    );
  });

  it("should get critical apps", async () => {
    const orgId = "org1";
    const response = [
      { id: "id1", organizationId: "org1", uri: "https://example.com" },
      { id: "id2", organizationId: "org2", uri: "https://example.org" },
    ] as PasswordHealthReportApplicationsResponse[];

    apiService.send.mockResolvedValue(response);
    await service.getCriticalApps(orgId);

    expect(apiService.send).toHaveBeenCalledWith(
      "GET",
      `/reports/password-health-report-applications/${orgId}`,
      null,
      true,
      true,
    );
  });
});
