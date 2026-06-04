import { TestBed } from "@angular/core/testing";
import { ActivatedRoute } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { AdminConsoleCipherFormConfigService } from "../../../../vault/org-vault/services/admin-console-cipher-form-config.service";
import { OrgReportContextService } from "../../services/org-report-context.service";

import { UnsecuredWebsitesReportComponent } from "./unsecured-websites-report.component";

// Allow the async route-subscription callback to settle before asserting.
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("UnsecuredWebsitesReportComponent (organization)", () => {
  let component: UnsecuredWebsitesReportComponent;
  let cipherService: MockProxy<CipherService>;
  let organizationService: MockProxy<OrganizationService>;
  let accountService: MockProxy<AccountService>;
  let logService: MockProxy<LogService>;
  let orgReportContext: MockProxy<OrgReportContextService>;

  const organization = { id: "org1" } as any;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    cipherService.getAllFromApiForOrganization.mockResolvedValue([]);
    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([organization]));
    accountService = mock<AccountService>();
    accountService.activeAccount$ = of({ id: "user1" } as any);
    logService = mock<LogService>();
    orgReportContext = mock<OrgReportContextService>();
    orgReportContext.load.mockResolvedValue({
      organization,
      manageableCipherIds: new Set(["c1", "c2"]),
      sharedCollectionIds: new Set(),
    });

    const route = {
      parent: { parent: { params: of({ organizationId: "org1" }) } },
    } as unknown as ActivatedRoute;

    TestBed.configureTestingModule({
      providers: [{ provide: OrgReportContextService, useValue: orgReportContext }],
    });
    component = TestBed.runInInjectionContext(
      () =>
        new UnsecuredWebsitesReportComponent(
          cipherService,
          mock<DialogService>(),
          route,
          organizationService,
          accountService,
          mock<PasswordRepromptService>(),
          mock<I18nService>(),
          mock<SyncService>(),
          mock<CollectionService>(),
          mock<CipherFormConfigService>(),
          mock<AdminConsoleCipherFormConfigService>(),
          logService,
        ),
    );
  });

  it("delegates context loading to OrgReportContextService and logs a successful initialization", async () => {
    await component.ngOnInit();
    await flushMicrotasks();

    expect(orgReportContext.load).toHaveBeenCalledWith(
      "org1",
      expect.stringContaining("[UnsecuredWebsitesReport] [Enterprise]"),
    );
    expect(logService.error).not.toHaveBeenCalled();
    expect(logService.info).toHaveBeenCalledWith(
      expect.stringContaining("Initialized report for organization org1 with 2 manageable ciphers"),
    );
  });

  it("logs an error when loading organization ciphers fails", async () => {
    cipherService.getAllFromApiForOrganization.mockRejectedValue(new Error("ciphers load failed"));

    await component.ngOnInit();
    await flushMicrotasks();

    expect(logService.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load organization ciphers"),
      expect.any(Error),
    );
  });

  it("does not log a successful initialization when context loading fails", async () => {
    orgReportContext.load.mockRejectedValue(new Error("context load failed"));

    await component.ngOnInit();
    await flushMicrotasks();

    expect(logService.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Initialized report for organization"),
    );
  });
});
