import { mock } from "jest-mock-extended";
import { lastValueFrom } from "rxjs";

import { ApiService } from "../../../abstractions/api.service";
import { ListResponse } from "../../../models/response/list.response";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { OrganizationDomainSsoDetailsResponse } from "../../abstractions/organization-domain/responses/organization-domain-sso-details.response";
import { OrganizationDomainResponse } from "../../abstractions/organization-domain/responses/organization-domain.response";
import { VerifiedOrganizationDomainSsoDetailsResponse } from "../../abstractions/organization-domain/responses/verified-organization-domain-sso-details.response";

import { OrgDomainApiService } from "./org-domain-api.service";
import { OrgDomainService } from "./org-domain.service";
import { OrganizationDomainSsoDetailsRequest } from "./requests/organization-domain-sso-details.request";

const mockedGetAllByOrgIdResponse: any = {
  data: [
    {
      id: "ca01a674-7f2f-45f2-8245-af6d016416b7",
      organizationId: "cb903acf-2361-4072-ae32-af6c014943b6",
      txt: "bw=EUX6UKR8A68igAJkmodwkzMiqB00u7Iyq1QqALu6jFID",
      domainName: "test.com",
      creationDate: "2022-12-16T21:36:28.68Z",
      nextRunDate: "2022-12-17T09:36:28.68Z",
      jobRunCount: 0,
      verifiedDate: null as any,
      lastCheckedDate: "2022-12-16T21:36:28.7633333Z",
      object: "organizationDomain",
    },
    {
      id: "adbd44c5-90d5-4537-97e6-af6d01644870",
      organizationId: "cb903acf-2361-4072-ae32-af6c014943b6",
      txt: "bw=Ql4fCfDacmcjwyAP9BPmvhSMTCz4PkEDm4uQ3fH01pD4",
      domainName: "test2.com",
      creationDate: "2022-12-16T21:37:10.9566667Z",
      nextRunDate: "2022-12-17T09:37:10.9566667Z",
      jobRunCount: 0,
      verifiedDate: "totally verified",
      lastCheckedDate: "2022-12-16T21:37:11.1933333Z",
      object: "organizationDomain",
    },
    {
      id: "05cf3ab8-bcfe-4b95-92e8-af6d01680942",
      organizationId: "cb903acf-2361-4072-ae32-af6c014943b6",
      txt: "bw=EQNUs77BWQHbfSiyc/9nT3wCen9z2yMn/ABCz0cNKaTx",
      domainName: "test3.com",
      creationDate: "2022-12-16T21:50:50.96Z",
      nextRunDate: "2022-12-17T09:50:50.96Z",
      jobRunCount: 0,
      verifiedDate: null,
      lastCheckedDate: "2022-12-16T21:50:51.0933333Z",
      object: "organizationDomain",
    },
  ],
  continuationToken: null as any,
  object: "list",
};

const mockedOrgDomainServerResponse = {
  id: "ca01a674-7f2f-45f2-8245-af6d016416b7",
  organizationId: "cb903acf-2361-4072-ae32-af6c014943b6",
  txt: "bw=EUX6UKR8A68igAJkmodwkzMiqB00u7Iyq1QqALu6jFID",
  domainName: "test.com",
  creationDate: "2022-12-16T21:36:28.68Z",
  nextRunDate: "2022-12-17T09:36:28.68Z",
  jobRunCount: 0,
  verifiedDate: null as any,
  lastCheckedDate: "2022-12-16T21:36:28.7633333Z",
  object: "organizationDomain",
};

const mockedOrgDomainResponse = new OrganizationDomainResponse(mockedOrgDomainServerResponse);

const mockedOrganizationDomainSsoDetailsServerResponse = {
  id: "fake-guid",
  organizationIdentifier: "fake-org-identifier",
  ssoAvailable: true,
  domainName: "fake-domain-name",
  verifiedDate: "2022-12-16T21:36:28.68Z",
};

const mockedOrganizationDomainSsoDetailsResponse = new OrganizationDomainSsoDetailsResponse(
  mockedOrganizationDomainSsoDetailsServerResponse,
);

const mockedVerifiedOrganizationDomain = {
  organizationIdentifier: "fake-org-identifier",
  organizationName: "fake-org",
  domainName: "fake-domain-name",
};

const mockedVerifiedOrganizationDomainSsoResponse =
  new VerifiedOrganizationDomainSsoDetailsResponse(mockedVerifiedOrganizationDomain);

const mockedVerifiedOrganizationDomainSsoDetailsListResponse = {
  data: [mockedVerifiedOrganizationDomain],
} as ListResponse<VerifiedOrganizationDomainSsoDetailsResponse>;

describe("Org Domain API Service", () => {
  let orgDomainApiService: OrgDomainApiService;

  const apiService = mock<ApiService>();

  let orgDomainService: OrgDomainService;

  const platformUtilService = mock<PlatformUtilsService>();
  const i18nService = mock<I18nService>();

  beforeEach(() => {
    orgDomainService = new OrgDomainService(platformUtilService, i18nService);
    jest.resetAllMocks();

    orgDomainApiService = new OrgDomainApiService(orgDomainService, apiService);
  });

  it("instantiates", () => {
    expect(orgDomainApiService).not.toBeFalsy();
  });

  it("getAllByOrgId retrieves all org domains and calls orgDomainSvc replace", () => {
    apiService.send.mockResolvedValue(mockedGetAllByOrgIdResponse);

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(0);

    const orgDomainSvcReplaceSpy = jest.spyOn(orgDomainService, "replace");

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    orgDomainApiService
      .getAllByOrgId("fakeOrgId")
      .then((orgDomainResponses: Array<OrganizationDomainResponse>) => {
        expect(orgDomainResponses).toHaveLength(3);

        expect(orgDomainSvcReplaceSpy).toHaveBeenCalled();
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(3);
      });
  });

  it("getByOrgIdAndOrgDomainId retrieves single org domain and calls orgDomainSvc upsert", () => {
    apiService.send.mockResolvedValue(mockedOrgDomainServerResponse);

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(0);

    const orgDomainSvcUpsertSpy = jest.spyOn(orgDomainService, "upsert");

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    orgDomainApiService
      .getByOrgIdAndOrgDomainId("fakeOrgId", "fakeDomainId")
      .then((orgDomain: OrganizationDomainResponse) => {
        expect(orgDomain.id).toEqual(mockedOrgDomainServerResponse.id);

        expect(orgDomainSvcUpsertSpy).toHaveBeenCalled();
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(1);
      });
  });

  it("post success should call orgDomainSvc upsert", () => {
    apiService.send.mockResolvedValue(mockedOrgDomainServerResponse);

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(0);

    const orgDomainSvcUpsertSpy = jest.spyOn(orgDomainService, "upsert");

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    orgDomainApiService
      .post("fakeOrgId", mockedOrgDomainResponse)
      .then((orgDomain: OrganizationDomainResponse) => {
        expect(orgDomain.id).toEqual(mockedOrgDomainServerResponse.id);

        expect(orgDomainSvcUpsertSpy).toHaveBeenCalled();
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(1);
      });
  });

  it("verify success should call orgDomainSvc upsert", () => {
    apiService.send.mockResolvedValue(mockedOrgDomainServerResponse);

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(0);

    const orgDomainSvcUpsertSpy = jest.spyOn(orgDomainService, "upsert");

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    orgDomainApiService
      .verify("fakeOrgId", "fakeOrgId")
      .then((orgDomain: OrganizationDomainResponse) => {
        expect(orgDomain.id).toEqual(mockedOrgDomainServerResponse.id);

        expect(orgDomainSvcUpsertSpy).toHaveBeenCalled();
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(1);
      });
  });

  it("delete success should call orgDomainSvc delete", () => {
    apiService.send.mockResolvedValue(true);
    orgDomainService.upsert([mockedOrgDomainResponse]);
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(1);

    const orgDomainSvcDeleteSpy = jest.spyOn(orgDomainService, "delete");

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    orgDomainApiService.delete("fakeOrgId", "fakeOrgId").then(() => {
      expect(orgDomainSvcDeleteSpy).toHaveBeenCalled();
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(0);
    });
  });

  it("getClaimedOrgDomainByEmail should call ApiService.send with correct parameters and return response", async () => {
    const email = "test@example.com";
    apiService.send.mockResolvedValue(mockedOrganizationDomainSsoDetailsServerResponse);

    const result = await orgDomainApiService.getClaimedOrgDomainByEmail(email);

    expect(apiService.send).toHaveBeenCalledWith(
      "POST",
      "/organizations/domain/sso/details",
      new OrganizationDomainSsoDetailsRequest(email),
      false, //anonymous
      true,
    );

    expect(result).toEqual(mockedOrganizationDomainSsoDetailsResponse);
  });

  it("getVerifiedOrgDomainsByEmail should call ApiService.send with correct parameters and return response", async () => {
    const email = "test@example.com";
    apiService.send.mockResolvedValue(mockedVerifiedOrganizationDomainSsoDetailsListResponse);

    const result = await orgDomainApiService.getVerifiedOrgDomainsByEmail(email);

    expect(apiService.send).toHaveBeenCalledWith(
      "POST",
      "/organizations/domain/sso/verified",
      new OrganizationDomainSsoDetailsRequest(email),
      false, //anonymous
      true,
    );

    expect(result.data).toContainEqual(mockedVerifiedOrganizationDomainSsoResponse);
  });
});
