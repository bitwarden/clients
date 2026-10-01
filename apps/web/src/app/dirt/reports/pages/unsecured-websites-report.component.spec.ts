import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { BreadcrumbsModule, DialogService, IconModule } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { cipherData } from "./reports-ciphers.mock";
import { UnsecuredWebsitesReportComponent } from "./unsecured-websites-report.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-header",
  template: "<ng-content select='[slot=breadcrumbs]'></ng-content><ng-content></ng-content>",
  standalone: false,
})
class MockHeaderComponent {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "bit-container",
  template: "<div></div>",
  standalone: false,
})
class MockBitContainerComponent {}

describe("UnsecuredWebsitesReportComponent", () => {
  const configService = mock<ConfigService>();

  let component: UnsecuredWebsitesReportComponent;
  let fixture: ComponentFixture<UnsecuredWebsitesReportComponent>;
  let organizationService: MockProxy<OrganizationService>;
  let syncServiceMock: MockProxy<SyncService>;
  let collectionService: MockProxy<CollectionService>;
  let adminConsoleCipherFormConfigService: MockProxy<AdminConsoleCipherFormConfigService>;
  const userId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(userId);

  beforeEach(async () => {
    let cipherFormConfigServiceMock: MockProxy<CipherFormConfigService>;
    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([]));
    syncServiceMock = mock<SyncService>();
    collectionService = mock<CollectionService>();
    adminConsoleCipherFormConfigService = mock<AdminConsoleCipherFormConfigService>();

    configService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      declarations: [
        UnsecuredWebsitesReportComponent,
        MockHeaderComponent,
        MockBitContainerComponent,
      ],
      imports: [I18nPipe, BreadcrumbsModule, IconModule],
      providers: [
        provideRouter([
          {
            path: "reports",
            children: [
              { path: "unsecured-websites-report", component: UnsecuredWebsitesReportComponent },
            ],
          },
        ]),
        {
          provide: CipherService,
          useValue: mock<CipherService>(),
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
          provide: PasswordRepromptService,
          useValue: mock<PasswordRepromptService>(),
        },
        {
          provide: SyncService,
          useValue: syncServiceMock,
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
          provide: CollectionService,
          useValue: collectionService,
        },
        {
          provide: CipherFormConfigService,
          useValue: cipherFormConfigServiceMock,
        },
        {
          provide: AdminConsoleCipherFormConfigService,
          useValue: adminConsoleCipherFormConfigService,
        },
        {
          provide: LogService,
          useValue: mock<LogService>(),
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(UnsecuredWebsitesReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });

  it("should render a header breadcrumb that navigates back to the reports home page", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      "/reports/unsecured-websites-report",
      UnsecuredWebsitesReportComponent,
    );

    const breadcrumbs = harness.fixture.debugElement.query(
      By.css("bit-breadcrumbs[slot=breadcrumbs]"),
    );
    expect(breadcrumbs).not.toBeNull();

    const links = breadcrumbs.queryAll(By.css("a[href]"));
    expect(links).toHaveLength(1);
    expect(links[0].nativeElement.getAttribute("href")).toBe("/reports");
  });

  it('should get only unsecured ciphers that the user has "Can Edit" access to', async () => {
    const expectedIdOne: any = "cbea34a8-bde4-46ad-9d19-b05001228ab2";
    const expectedIdTwo = "cbea34a8-bde4-46ad-9d19-b05001228cd3";
    jest.spyOn(component as any, "getAllCiphers").mockReturnValue(Promise.resolve<any>(cipherData));
    await component.setCiphers();

    expect(component.ciphers.length).toEqual(2);
    expect(component.ciphers[0].id).toEqual(expectedIdOne);
    expect(component.ciphers[0].edit).toEqual(true);
    expect(component.ciphers[1].id).toEqual(expectedIdTwo);
    expect(component.ciphers[1].edit).toEqual(true);
  });

  it("should call fullSync method of syncService", () => {
    expect(syncServiceMock.fullSync).toHaveBeenCalledWith(false);
  });

  it("should render the current page breadcrumb when the VFO1 feature flag is enabled", async () => {
    configService.getFeatureFlag$.mockReturnValue(of(true));
    const i18nService = TestBed.inject(I18nService) as MockProxy<I18nService>;
    i18nService.t.mockImplementation((key) => key);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      "/reports/unsecured-websites-report",
      UnsecuredWebsitesReportComponent,
    );

    const breadcrumbs = harness.fixture.debugElement.query(
      By.css("bit-breadcrumbs[slot=breadcrumbs]"),
    );
    const crumbs = breadcrumbs.queryAll(By.css("span[bitOverflowItem]"));
    expect(crumbs).toHaveLength(2);
    expect(crumbs[1].nativeElement.textContent.trim()).toBe("unsecuredWebsitesReport");
  });
});
