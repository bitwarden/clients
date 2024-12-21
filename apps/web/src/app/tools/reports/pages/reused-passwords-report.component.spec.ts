// eslint-disable-next-line no-restricted-imports
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { cipherData } from "./reports-ciphers.mock";
import { ReusedPasswordsReportComponent } from "./reused-passwords-report.component";

describe("ReusedPasswordsReportComponent", () => {
  let component: ReusedPasswordsReportComponent;
  let fixture: ComponentFixture<ReusedPasswordsReportComponent>;
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
      declarations: [ReusedPasswordsReportComponent, I18nPipe],
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
      ],
      schemas: [],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ReusedPasswordsReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });

  it('should get ciphers with reused passwords that the user has "Can Edit" access to', async () => {
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
});
