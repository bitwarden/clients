import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { ActivatedRoute, provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PasskeyDirectoryEntryResponse } from "@bitwarden/common/dirt/models/response/passkey-directory-entry.response";
import { PasskeyDirectoryApiService } from "@bitwarden/common/dirt/services/abstractions/passkey-directory-api.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { BreadcrumbsModule, DialogService, IconModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { AdminConsoleCipherFormConfigService } from "../../../../vault/org-vault/services/admin-console-cipher-form-config.service";
import { PasskeyReportService } from "../passkey-report.service";

import { OrgPasskeyReportComponent } from "./org-passkey-report.component";

describe("OrgPasskeyReportComponent", () => {
  const configService = mock<ConfigService>();

  let component: OrgPasskeyReportComponent;
  let fixture: ComponentFixture<OrgPasskeyReportComponent>;
  let cipherServiceMock: MockProxy<CipherService>;
  let organizationService: MockProxy<OrganizationService>;
  let passkeyDirectoryApiServiceMock: MockProxy<PasskeyDirectoryApiService>;
  const userId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(userId);
  const orgId = Utils.newGuid();

  const mockOrganization = {
    id: orgId,
    name: "Test Org",
    allowAdminAccessToAllCollectionItems: false,
  } as Organization;

  beforeEach(async () => {
    cipherServiceMock = mock<CipherService>();
    cipherServiceMock.getAll.mockResolvedValue([]);
    cipherServiceMock.getAllFromApiForOrganization.mockResolvedValue([]);
    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([mockOrganization]));
    passkeyDirectoryApiServiceMock = mock<PasskeyDirectoryApiService>();
    passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockResolvedValue([]);

    configService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      imports: [OrgPasskeyReportComponent, I18nPipe],
      providers: [
        provideRouter([
          {
            path: "organizations/:organizationId/reporting/reports",
            children: [{ path: "passkey-report", component: OrgPasskeyReportComponent }],
          },
        ]),
        {
          provide: CipherService,
          useValue: cipherServiceMock,
        },
        {
          provide: OrganizationService,
          useValue: organizationService,
        },
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: DialogService,
          useValue: mock<DialogService>(),
        },
        {
          provide: LogService,
          useValue: mock<LogService>(),
        },
        {
          provide: PasskeyDirectoryApiService,
          useValue: passkeyDirectoryApiServiceMock,
        },
        {
          provide: PasswordRepromptService,
          useValue: mock<PasswordRepromptService>(),
        },
        {
          provide: SyncService,
          useValue: mock<SyncService>(),
        },
        {
          provide: I18nService,
          useValue: mock<I18nService>(),
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: CipherFormConfigService,
          useValue: mock<CipherFormConfigService>(),
        },
        {
          provide: AdminConsoleCipherFormConfigService,
          useValue: mock<AdminConsoleCipherFormConfigService>(),
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ organizationId: orgId }),
            data: of({}),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(OrgPasskeyReportComponent, {
        set: {
          imports: [I18nPipe, BreadcrumbsModule, IconModule],
          schemas: [NO_ERRORS_SCHEMA],
          providers: [
            {
              provide: CipherFormConfigService,
              useValue: mock<CipherFormConfigService>(),
            },
            {
              provide: AdminConsoleCipherFormConfigService,
              useValue: mock<AdminConsoleCipherFormConfigService>(),
            },
            PasskeyReportService,
          ],
        },
      })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(OrgPasskeyReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });

  it("should render a header breadcrumb that navigates back to the reports home page", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/organizations/${orgId}/reporting/reports/passkey-report`,
      OrgPasskeyReportComponent,
    );

    const breadcrumbs = harness.fixture.debugElement.query(
      By.css("bit-breadcrumbs[slot=breadcrumbs]"),
    );
    expect(breadcrumbs).not.toBeNull();

    const links = breadcrumbs.queryAll(By.css("a[href]"));
    expect(links).toHaveLength(1);
    expect(links[0].nativeElement.getAttribute("href")).toBe(
      `/organizations/${orgId}/reporting/reports`,
    );
  });

  describe("loading ciphers", () => {
    it("should fetch ciphers from API when passkey services are available", async () => {
      passkeyDirectoryApiServiceMock.getPasskeyDirectory.mockResolvedValue([
        {
          domainName: "example.com",
          instructions: "https://example.com/passkey",
        } as PasskeyDirectoryEntryResponse,
      ]);

      // Re-create to pick up the new mock
      fixture = TestBed.createComponent(OrgPasskeyReportComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      // Allow the async effect to complete across microtask cycles
      fixture.detectChanges();
      await fixture.whenStable();

      expect(cipherServiceMock.getAllFromApiForOrganization).toHaveBeenCalledWith(
        mockOrganization.id,
        true,
      );
    });
  });

  describe("canManageCipher", () => {
    it("should return true when cipher has no collection IDs", () => {
      const cipher = { id: "cipher-1", collectionIds: [] } as unknown as CipherView;

      expect((component as any).canManageCipher(cipher)).toBe(true);
    });

    it("should return true when organization allows admin access to all collection items", async () => {
      // Override the organization signal by re-creating with admin access
      const adminOrg = {
        ...mockOrganization,
        allowAdminAccessToAllCollectionItems: true,
      } as Organization;
      organizationService.organizations$.mockReturnValue(of([adminOrg]));

      // Re-create the component with the updated org
      fixture = TestBed.createComponent(OrgPasskeyReportComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      const cipher = {
        id: "cipher-1",
        collectionIds: ["col-1"],
      } as unknown as CipherView;

      expect((component as any).canManageCipher(cipher)).toBe(true);
    });

    it("should return true when cipher is in manageable ciphers list", async () => {
      cipherServiceMock.getAll.mockResolvedValue([{ id: "cipher-1" } as Cipher]);

      // Re-create component so the constructor subscription picks up the new mock
      fixture = TestBed.createComponent(OrgPasskeyReportComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      await fixture.whenStable();

      const cipher = {
        id: "cipher-1",
        collectionIds: ["col-1"],
      } as unknown as CipherView;

      expect((component as any).canManageCipher(cipher)).toBe(true);
    });

    it("should return false when cipher is not in manageable ciphers list", () => {
      const cipher = {
        id: "cipher-1",
        collectionIds: ["col-1"],
      } as unknown as CipherView;

      expect((component as any).canManageCipher(cipher)).toBe(false);
    });
  });

  it("should render the current page breadcrumb when the VFO1 feature flag is enabled", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    const i18nService = TestBed.inject(I18nService) as MockProxy<I18nService>;
    i18nService.t.mockImplementation((key) => key);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/organizations/${orgId}/reporting/reports/passkey-report`,
      OrgPasskeyReportComponent,
    );

    const breadcrumbs = harness.fixture.debugElement.query(
      By.css("bit-breadcrumbs[slot=breadcrumbs]"),
    );
    const crumbs = breadcrumbs.queryAll(By.css("span[bitOverflowItem]"));
    expect(crumbs).toHaveLength(2);
    expect(crumbs[1].nativeElement.textContent.trim()).toBe("passkeyLoginReport");
  });
});
