import { mock, mockReset } from "jest-mock-extended";
import { lastValueFrom } from "rxjs";

import { I18nService } from "../../../platform/abstractions/i18n.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { OrganizationDomainResponse } from "../../abstractions/organization-domain/responses/organization-domain.response";

import { OrgDomainService } from "./org-domain.service";

const mockedUnverifiedDomainServerResponse = {
  creationDate: "2022-12-13T23:16:43.7066667Z",
  domainName: "bacon.com",
  id: "12eac4ea-9ed8-4dd4-85da-af6a017f9f97",
  jobRunCount: 0,
  lastCheckedDate: "2022-12-13T23:16:43.8033333Z",
  nextRunDate: "2022-12-14T11:16:43.7066667Z",
  object: "organizationDomain",
  organizationId: "e4bffa5e-6602-4bc7-a83f-af55016566ef",
  txt: "bw=eRBGgwJhZk0Kmpd8qPdSrrkSsTD006B+JgmMztk4XjDX",
  verifiedDate: null as any,
};

const mockedVerifiedDomainServerResponse = {
  creationDate: "2022-12-13T23:16:43.7066667Z",
  domainName: "cat.com",
  id: "58715f70-8650-4a42-9d4a-af6a0188151b",
  jobRunCount: 0,
  lastCheckedDate: "2022-12-13T23:16:43.8033333Z",
  nextRunDate: "2022-12-14T11:16:43.7066667Z",
  object: "organizationDomain",
  organizationId: "e4bffa5e-6602-4bc7-a83f-af55016566ef",
  txt: "bw=eRBGgwJhZk0Kmpd8qPdSrrkSsTD006B+JgmMztk4XjDX",
  verifiedDate: "2022-12-13T23:16:43.7066667Z",
};

const mockedExtraDomainServerResponse = {
  creationDate: "2022-12-13T23:16:43.7066667Z",
  domainName: "dog.com",
  id: "fac7cdb6-283e-4805-aa55-af6b016bf699",
  jobRunCount: 0,
  lastCheckedDate: "2022-12-13T23:16:43.8033333Z",
  nextRunDate: "2022-12-14T11:16:43.7066667Z",
  object: "organizationDomain",
  organizationId: "e4bffa5e-6602-4bc7-a83f-af55016566ef",
  txt: "bw=eRBGgwJhZk0Kmpd8qPdSrrkSsTD006B+JgmMztk4XjDX",
  verifiedDate: null as any,
};

const mockedUnverifiedOrgDomainResponse = new OrganizationDomainResponse(
  mockedUnverifiedDomainServerResponse,
);
const mockedVerifiedOrgDomainResponse = new OrganizationDomainResponse(
  mockedVerifiedDomainServerResponse,
);

const mockedExtraOrgDomainResponse = new OrganizationDomainResponse(
  mockedExtraDomainServerResponse,
);

describe("Org Domain Service", () => {
  let orgDomainService: OrgDomainService;

  const platformUtilService = mock<PlatformUtilsService>();
  const i18nService = mock<I18nService>();

  beforeEach(() => {
    mockReset(platformUtilService);
    mockReset(i18nService);

    orgDomainService = new OrgDomainService(platformUtilService, i18nService);
  });

  it("instantiates", () => {
    expect(orgDomainService).not.toBeFalsy();
  });

  it("orgDomains$ public observable exists and instantiates w/ empty array", () => {
    expect(orgDomainService.orgDomains$).toBeDefined();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toEqual([]);
  });

  it("replace and clear work", () => {
    const newOrgDomains = [mockedUnverifiedOrgDomainResponse, mockedVerifiedOrgDomainResponse];

    orgDomainService.replace(newOrgDomains);

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toEqual(newOrgDomains);

    orgDomainService.clearCache();

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toEqual([]);
  });

  it("get successfully retrieves org domain by id", () => {
    const orgDomains = [mockedUnverifiedOrgDomainResponse, mockedVerifiedOrgDomainResponse];
    orgDomainService.replace(orgDomains);

    expect(orgDomainService.get(mockedVerifiedOrgDomainResponse.id)).toEqual(
      mockedVerifiedOrgDomainResponse,
    );

    expect(orgDomainService.get(mockedUnverifiedOrgDomainResponse.id)).toEqual(
      mockedUnverifiedOrgDomainResponse,
    );
  });

  it("upsert both updates an existing org domain and adds a new one", () => {
    const orgDomains = [mockedUnverifiedOrgDomainResponse, mockedVerifiedOrgDomainResponse];
    orgDomainService.replace(orgDomains);

    const changedOrgDomain = new OrganizationDomainResponse(mockedVerifiedDomainServerResponse);
    changedOrgDomain.domainName = "changed domain name";

    expect(mockedVerifiedOrgDomainResponse.domainName).not.toEqual(changedOrgDomain.domainName);

    orgDomainService.upsert([changedOrgDomain]);

    expect(orgDomainService.get(mockedVerifiedOrgDomainResponse.id).domainName).toEqual(
      changedOrgDomain.domainName,
    );

    const newOrgDomain = new OrganizationDomainResponse({
      creationDate: "2022-12-13T23:16:43.7066667Z",
      domainName: "cat.com",
      id: "magical-cat-id-number-999",
      jobRunCount: 0,
      lastCheckedDate: "2022-12-13T23:16:43.8033333Z",
      nextRunDate: "2022-12-14T11:16:43.7066667Z",
      object: "organizationDomain",
      organizationId: "e4bffa5e-6602-4bc7-a83f-af55016566ef",
      txt: "bw=eRBGgwJhZk0Kmpd8qPdSrrkSsTD006B+JgmMztk4XjDX",
      verifiedDate: null as any,
    });

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(2);

    orgDomainService.upsert([newOrgDomain]);

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(3);

    expect(orgDomainService.get(newOrgDomain.id)).toEqual(newOrgDomain);
  });

  it("delete successfully removes multiple org domains", () => {
    const orgDomains = [
      mockedUnverifiedOrgDomainResponse,
      mockedVerifiedOrgDomainResponse,
      mockedExtraOrgDomainResponse,
    ];
    orgDomainService.replace(orgDomains);
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(3);

    orgDomainService.delete([mockedUnverifiedOrgDomainResponse.id]);

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(2);
    expect(orgDomainService.get(mockedUnverifiedOrgDomainResponse.id)).toEqual(undefined);

    orgDomainService.delete([mockedVerifiedOrgDomainResponse.id, mockedExtraOrgDomainResponse.id]);
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    expect(lastValueFrom(orgDomainService.orgDomains$)).resolves.toHaveLength(0);
    expect(orgDomainService.get(mockedVerifiedOrgDomainResponse.id)).toEqual(undefined);
    expect(orgDomainService.get(mockedExtraOrgDomainResponse.id)).toEqual(undefined);
  });

  it("copyDnsTxt copies DNS TXT to clipboard and shows toast", () => {
    orgDomainService.copyDnsTxt("fakeTxt");
    expect(jest.spyOn(platformUtilService, "copyToClipboard")).toHaveBeenCalled();
  });
});
