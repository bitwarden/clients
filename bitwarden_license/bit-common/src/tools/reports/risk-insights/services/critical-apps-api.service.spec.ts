import { randomUUID } from "crypto";

import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { Guid } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import {
  CriticalAppsApiService,
  PasswordHealthReportApplicationsRequest,
  PasswordHealthReportApplicationsResponse,
} from "./critical-apps-api.service";

describe("CriticalAppsApiService", () => {
  let service: CriticalAppsApiService;
  const apiService = mock<ApiService>();
  const keyService = mock<KeyService>();
  const encryptService = mock<EncryptService>();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CriticalAppsApiService,
        { provide: ApiService, useValue: apiService },
        { provide: KeyService, useValue: keyService },
        { provide: EncryptService, useValue: encryptService },
      ],
    });
    service = TestBed.inject(CriticalAppsApiService);

    // reset mocks
    jest.resetAllMocks();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should set critical apps", async () => {
    // arrange
    const criticalApps = ["https://example.com", "https://example.org"];

    const request = [
      { organizationId: "org1", url: "encryptedUrlName" },
      { organizationId: "org1", url: "encryptedUrlName" },
    ] as PasswordHealthReportApplicationsRequest[];

    const response = [
      { id: "id1", organizationId: "org1", uri: "https://example.com" },
      { id: "id2", organizationId: "org1", uri: "https://example.org" },
    ] as PasswordHealthReportApplicationsResponse[];

    encryptService.encrypt.mockResolvedValue(new EncString("encryptedUrlName"));
    apiService.send.mockResolvedValue(response);

    // act
    await service.setCriticalApps("org1", criticalApps);

    // expectations
    expect(keyService.getOrgKey).toHaveBeenCalledWith("org1");
    expect(encryptService.encrypt).toHaveBeenCalledTimes(2);
    expect(apiService.send).toHaveBeenCalledWith(
      "POST",
      "/reports/password-health-report-applications/",
      request,
      true,
      true,
    );
  });

  it("should exclude records that already exist", async () => {
    // arrange
    // one record already exists
    service.criticalApps = [
      { id: randomUUID() as Guid, organizationId: "org1" as Guid, uri: "https://example.com" },
    ];

    // two records are selected - one already in the database
    const selectedUrls = ["https://example.com", "https://example.org"];

    // expect only one record to be sent to the server
    const request = [
      { organizationId: "org1", url: "encryptedUrlName" },
    ] as PasswordHealthReportApplicationsRequest[];

    // mocked response
    const response = [
      { id: "id1", organizationId: "org1", uri: "test" },
    ] as PasswordHealthReportApplicationsResponse[];

    encryptService.encrypt.mockResolvedValue(new EncString("encryptedUrlName"));
    apiService.send.mockResolvedValue(response);

    // act
    await service.setCriticalApps("org1", selectedUrls);

    // expectations
    expect(keyService.getOrgKey).toHaveBeenCalledWith("org1");
    expect(encryptService.encrypt).toHaveBeenCalledTimes(1);
    expect(apiService.send).toHaveBeenCalledWith(
      "POST",
      "/reports/password-health-report-applications/",
      request,
      true,
      true,
    );
  });

  it("should get critical apps", async () => {
    const orgId = "org1";
    const response = [
      { id: "id1", organizationId: "org1", uri: "https://example.com" },
      { id: "id2", organizationId: "org1", uri: "https://example.org" },
    ] as PasswordHealthReportApplicationsResponse[];

    encryptService.decryptToUtf8.mockResolvedValue("https://example.com");
    apiService.send.mockResolvedValue(response);
    await service.getCriticalApps(orgId);

    expect(keyService.getOrgKey).toHaveBeenCalledWith(orgId);
    expect(encryptService.decryptToUtf8).toHaveBeenCalledTimes(2);
    expect(apiService.send).toHaveBeenCalledWith(
      "GET",
      `/reports/password-health-report-applications/${orgId}`,
      null,
      true,
      true,
    );
  });
});
