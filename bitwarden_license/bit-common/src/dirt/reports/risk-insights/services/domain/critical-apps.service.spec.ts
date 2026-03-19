import { randomUUID } from "crypto";

import { mock } from "jest-mock-extended";
import { of, BehaviorSubject } from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId, OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import {
  PasswordHealthReportApplicationsRequest,
  PasswordHealthReportApplicationsResponse,
} from "../../models/api-models.types";
import { PasswordHealthReportApplicationId } from "../../models/report-models";
import { CriticalAppsApiService } from "../api/critical-apps-api.service";

import { CriticalAppsService } from "./critical-apps.service";

const SomeCsprngArray = new Uint8Array(64) as CsprngArray;
const SomeUser = "some user" as UserId;
const SomeOrganization = "some organization" as OrganizationId;
const AnotherOrganization = "another organization" as OrganizationId;
const SomeOrgKey = new SymmetricCryptoKey(SomeCsprngArray) as OrgKey;
const AnotherOrgKey = new SymmetricCryptoKey(SomeCsprngArray) as OrgKey;
const OrgRecords: Record<OrganizationId, OrgKey> = {
  [SomeOrganization]: SomeOrgKey,
  [AnotherOrganization]: AnotherOrgKey,
};

describe("CriticalAppsService", () => {
  let service: CriticalAppsService;
  const keyService = mock<KeyService>();
  const encryptService = mock<EncryptService>();
  const criticalAppsApiService = mock<CriticalAppsApiService>({
    saveCriticalApps: jest.fn(),
    getCriticalApps: jest.fn(),
  });

  beforeEach(() => {
    service = new CriticalAppsService(keyService, encryptService, criticalAppsApiService);

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
      { organizationId: SomeOrganization, url: "encryptedUrlName" },
      { organizationId: SomeOrganization, url: "encryptedUrlName" },
    ] as PasswordHealthReportApplicationsRequest[];

    const response = [
      { id: "id1", organizationId: SomeOrganization, uri: "https://example.com" },
      { id: "id2", organizationId: SomeOrganization, uri: "https://example.org" },
    ] as PasswordHealthReportApplicationsResponse[];

    encryptService.encryptString.mockResolvedValue(new EncString("encryptedUrlName"));
    criticalAppsApiService.saveCriticalApps.mockReturnValue(of(response));
    const orgKey$ = new BehaviorSubject(OrgRecords);
    keyService.orgKeys$.mockReturnValue(orgKey$);

    service.loadOrganizationContext(SomeOrganization, SomeUser);

    // act
    await service.setCriticalApps(SomeOrganization, criticalApps);

    // expectations
    expect(keyService.orgKeys$).toHaveBeenCalledWith(SomeUser);
    expect(encryptService.encryptString).toHaveBeenCalledTimes(2);
    expect(criticalAppsApiService.saveCriticalApps).toHaveBeenCalledWith(request);
  });

  it("should exclude records that already exist", async () => {
    const privateCriticalAppsSubject = service["criticalAppsListSubject$"];
    // arrange
    // one record already exists
    privateCriticalAppsSubject.next([
      {
        id: randomUUID() as PasswordHealthReportApplicationId,
        organizationId: SomeOrganization,
        uri: "https://example.com",
      },
    ]);

    // two records are selected - one already in the database
    const selectedUrls = ["https://example.com", "https://example.org"];

    // expect only one record to be sent to the server
    const request = [
      { organizationId: SomeOrganization, url: "encryptedUrlName" },
    ] as PasswordHealthReportApplicationsRequest[];

    // mocked response
    const response = [
      { id: "id1", organizationId: SomeOrganization, uri: "test" },
    ] as PasswordHealthReportApplicationsResponse[];

    encryptService.encryptString.mockResolvedValue(new EncString("encryptedUrlName"));
    criticalAppsApiService.saveCriticalApps.mockReturnValue(of(response));

    // mock org keys
    const orgKey$ = new BehaviorSubject(OrgRecords);
    keyService.orgKeys$.mockReturnValue(orgKey$);

    service.loadOrganizationContext(SomeOrganization, SomeUser);

    // act
    await service.setCriticalApps(SomeOrganization, selectedUrls);

    // expectations
    expect(keyService.orgKeys$).toHaveBeenCalledWith(SomeUser);
    expect(encryptService.encryptString).toHaveBeenCalledTimes(1);
    expect(criticalAppsApiService.saveCriticalApps).toHaveBeenCalledWith(request);
  });

  it("should get critical apps", () => {
    const response = [
      { id: "id1", organizationId: SomeOrganization, uri: "https://example.com" },
      { id: "id2", organizationId: SomeOrganization, uri: "https://example.org" },
    ] as PasswordHealthReportApplicationsResponse[];

    encryptService.decryptString.mockResolvedValue("https://example.com");
    criticalAppsApiService.getCriticalApps.mockReturnValue(of(response));

    // mock org keys
    const orgKey$ = new BehaviorSubject(OrgRecords);
    keyService.orgKeys$.mockReturnValue(orgKey$);

    service.loadOrganizationContext(SomeOrganization, SomeUser);

    expect(keyService.orgKeys$).toHaveBeenCalledWith(SomeUser);
    expect(encryptService.decryptString).toHaveBeenCalledTimes(2);
    expect(criticalAppsApiService.getCriticalApps).toHaveBeenCalledWith(SomeOrganization);
  });

  it("should get by org id", () => {
    const orgId = "some organization" as OrganizationId;
    const privateCriticalAppsSubject = service["criticalAppsListSubject$"];
    const response = [
      { id: "id1", organizationId: "some organization", uri: "https://example.com" },
      { id: "id2", organizationId: "some organization", uri: "https://example.org" },
      { id: "id3", organizationId: "another organization", uri: "https://example.org" },
      { id: "id4", organizationId: "another organization", uri: "https://example.org" },
    ] as PasswordHealthReportApplicationsResponse[];

    const orgKey$ = new BehaviorSubject(OrgRecords);
    keyService.orgKeys$.mockReturnValue(orgKey$);
    service.loadOrganizationContext(SomeOrganization, SomeUser);
    privateCriticalAppsSubject.next(response);
    service.getAppsListForOrg(orgId as OrganizationId).subscribe((res) => {
      expect(res).toHaveLength(2);
    });
  });

  it("should drop a critical app", async () => {
    const privateCriticalAppsSubject = service["criticalAppsListSubject$"];
    // arrange
    const selectedUrl = "https://example.com";

    const initialList = [
      { id: "id1", organizationId: SomeOrganization, uri: "https://example.com" },
      { id: "id2", organizationId: SomeOrganization, uri: "https://example.org" },
    ] as PasswordHealthReportApplicationsResponse[];

    const orgKey$ = new BehaviorSubject(OrgRecords);
    keyService.orgKeys$.mockReturnValue(orgKey$);

    service.loadOrganizationContext(SomeOrganization, SomeUser);

    privateCriticalAppsSubject.next(initialList);

    // act
    await service.dropCriticalAppByUrl(SomeOrganization, selectedUrl);

    // expectations
    expect(criticalAppsApiService.dropCriticalApp).toHaveBeenCalledWith({
      organizationId: SomeOrganization,
      passwordHealthReportApplicationIds: ["id1"],
    });
    expect(service.getAppsListForOrg(SomeOrganization)).toBeTruthy();
    service.getAppsListForOrg(SomeOrganization).subscribe((res) => {
      expect(res).toHaveLength(1);
      expect(res[0].uri).toBe("https://example.org");
    });
  });

  it("should not drop a critical app if it does not exist", async () => {
    const privateCriticalAppsSubject = service["criticalAppsListSubject$"];
    // arrange
    const selectedUrl = "https://nonexistent.com";

    const initialList = [
      { id: "id1", organizationId: SomeOrganization, uri: "https://example.com" },
      { id: "id2", organizationId: SomeOrganization, uri: "https://example.org" },
    ] as PasswordHealthReportApplicationsResponse[];

    const orgKey$ = new BehaviorSubject(OrgRecords);
    keyService.orgKeys$.mockReturnValue(orgKey$);

    service.loadOrganizationContext(SomeOrganization, SomeUser);

    privateCriticalAppsSubject.next(initialList);

    // act
    await service.dropCriticalAppByUrl(SomeOrganization, selectedUrl);

    // expectations
    expect(criticalAppsApiService.dropCriticalApp).not.toHaveBeenCalled();
    expect(service.getAppsListForOrg(SomeOrganization)).toBeTruthy();
    service.getAppsListForOrg(SomeOrganization).subscribe((res) => {
      expect(res).toHaveLength(2);
    });
  });
});
