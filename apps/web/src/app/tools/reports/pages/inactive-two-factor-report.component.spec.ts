// eslint-disable-next-line no-restricted-imports
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { CipherReportComponent } from "./cipher-report.component";
import { InactiveTwoFactorReportComponent } from "./inactive-two-factor-report.component";
import { cipherData } from "./reports-ciphers.mock";

describe("InactiveTwoFactorReportComponent", () => {
  let component: InactiveTwoFactorReportComponent;
  let fixture: ComponentFixture<InactiveTwoFactorReportComponent>;
  let organizationService: MockProxy<OrganizationService>;
  let syncServiceMock: MockProxy<SyncService>;

  beforeEach(() => {
    let cipherFormConfigServiceMock: MockProxy<CipherFormConfigService>;
    organizationService = mock<OrganizationService>();
    organizationService.organizations$ = of([]);
    syncServiceMock = mock<SyncService>();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    TestBed.configureTestingModule({
      declarations: [InactiveTwoFactorReportComponent, I18nPipe],
      providers: [
        {
          provide: CipherService,
          useValue: mock<CipherService>(),
        },
        {
          provide: OrganizationService,
          useValue: organizationService,
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
          provide: CipherFormConfigService,
          useValue: cipherFormConfigServiceMock,
        },
        {
          provide: CipherReportComponent,
          useValue: mock<CipherReportComponent>(),
        },
      ],
      schemas: [],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InactiveTwoFactorReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });

  it('should get only ciphers with domains in the 2fa directory that they have "Can Edit" access to', async () => {
    const expectedIdOne: any = "cbea34a8-bde4-46ad-9d19-b05001228xy4";
    const expectedIdTwo: any = "cbea34a8-bde4-46ad-9d19-b05001227nm5";
    component.services.set(
      "101domain.com",
      "https://help.101domain.com/account-management/account-security/enabling-disabling-two-factor-verification",
    );
    component.services.set(
      "123formbuilder.com",
      "https://www.123formbuilder.com/docs/multi-factor-authentication-login",
    );

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
});
