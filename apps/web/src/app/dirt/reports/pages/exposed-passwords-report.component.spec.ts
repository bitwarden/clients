import { Component, ChangeDetectionStrategy } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  DialogService,
  AsyncActionsModule,
  BreadcrumbsModule,
  ButtonModule,
  FormFieldModule,
  IconModule,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { ExposedPasswordsReportComponent } from "./exposed-passwords-report.component";
import { cipherData } from "./reports-ciphers.mock";

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

describe("ExposedPasswordsReportComponent", () => {
  const configService = mock<ConfigService>();

  let component: ExposedPasswordsReportComponent;
  let fixture: ComponentFixture<ExposedPasswordsReportComponent>;
  let auditService: MockProxy<AuditService>;
  let organizationService: MockProxy<OrganizationService>;
  let syncServiceMock: MockProxy<SyncService>;
  let adminConsoleCipherFormConfigServiceMock: MockProxy<AdminConsoleCipherFormConfigService>;
  const userId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(userId);

  beforeEach(async () => {
    let cipherFormConfigServiceMock: MockProxy<CipherFormConfigService>;
    syncServiceMock = mock<SyncService>();
    auditService = mock<AuditService>();
    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([]));
    configService.getFeatureFlag$.mockReturnValue(of(false));

    await TestBed.configureTestingModule({
      declarations: [
        ExposedPasswordsReportComponent,
        MockHeaderComponent,
        MockBitContainerComponent,
      ],
      imports: [
        I18nPipe,
        AsyncActionsModule,
        ButtonModule,
        FormFieldModule,
        BreadcrumbsModule,
        IconModule,
      ],
      providers: [
        provideRouter([
          {
            path: "reports",
            children: [
              { path: "exposed-passwords-report", component: ExposedPasswordsReportComponent },
            ],
          },
        ]),
        {
          provide: CipherService,
          useValue: mock<CipherService>(),
        },
        {
          provide: AuditService,
          useValue: auditService,
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
          provide: CipherFormConfigService,
          useValue: cipherFormConfigServiceMock,
        },
        {
          provide: AdminConsoleCipherFormConfigService,
          useValue: adminConsoleCipherFormConfigServiceMock,
        },
        {
          provide: LogService,
          useValue: mock<LogService>(),
        },
      ],
      schemas: [],
    }).compileComponents();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fixture = TestBed.createComponent(ExposedPasswordsReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });

  it("should render a header breadcrumb that navigates back to the reports home page", async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      "/reports/exposed-passwords-report",
      ExposedPasswordsReportComponent,
    );

    const breadcrumbs = harness.fixture.debugElement.query(
      By.css("bit-breadcrumbs[slot=breadcrumbs]"),
    );
    expect(breadcrumbs).not.toBeNull();

    const links = breadcrumbs.queryAll(By.css("a[href]"));
    expect(links).toHaveLength(1);
    expect(links[0].nativeElement.getAttribute("href")).toBe("/reports");
  });

  it('should get only ciphers with exposed passwords that the user has "Can Edit" access to', async () => {
    const expectedIdOne: any = "cbea34a8-bde4-46ad-9d19-b05001228ab2";
    const expectedIdTwo = "cbea34a8-bde4-46ad-9d19-b05001228cd3";

    jest.spyOn(auditService, "passwordLeaked").mockReturnValue(Promise.resolve<any>(1234));
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
      "/reports/exposed-passwords-report",
      ExposedPasswordsReportComponent,
    );

    const breadcrumbs = harness.fixture.debugElement.query(
      By.css("bit-breadcrumbs[slot=breadcrumbs]"),
    );
    const crumbs = breadcrumbs.queryAll(By.css("span[bitOverflowItem]"));
    expect(crumbs).toHaveLength(2);
    expect(crumbs[1].nativeElement.textContent.trim()).toBe("exposedPasswordsReport");
  });
});
