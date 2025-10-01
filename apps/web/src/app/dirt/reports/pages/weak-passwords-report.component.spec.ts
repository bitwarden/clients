import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { cipherData } from "./reports-ciphers.mock";
import { WeakPasswordsReportComponent } from "./weak-passwords-report.component";

describe("WeakPasswordsReportComponent", () => {
  let component: WeakPasswordsReportComponent;
  let fixture: ComponentFixture<WeakPasswordsReportComponent>;
  let passwordStrengthService: MockProxy<PasswordStrengthServiceAbstraction>;
  let organizationService: MockProxy<OrganizationService>;
  let syncServiceMock: MockProxy<SyncService>;
  let adminConsoleCipherFormConfigServiceMock: MockProxy<AdminConsoleCipherFormConfigService>;
  const userId = Utils.newGuid() as UserId;
  const accountService: FakeAccountService = mockAccountServiceWith(userId);

  beforeEach(() => {
    let cipherFormConfigServiceMock: MockProxy<CipherFormConfigService>;
    syncServiceMock = mock<SyncService>();
    passwordStrengthService = mock<PasswordStrengthServiceAbstraction>();
    organizationService = mock<OrganizationService>();
    organizationService.organizations$.mockReturnValue(of([]));
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    TestBed.configureTestingModule({
      declarations: [WeakPasswordsReportComponent, I18nPipe],
      providers: [
        {
          provide: CipherService,
          useValue: mock<CipherService>(),
        },
        {
          provide: PasswordStrengthServiceAbstraction,
          useValue: passwordStrengthService,
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
          provide: CipherFormConfigService,
          useValue: cipherFormConfigServiceMock,
        },

        {
          provide: AdminConsoleCipherFormConfigService,
          useValue: adminConsoleCipherFormConfigServiceMock,
        },
        {
          provide: CollectionService,
          useValue: mock<CollectionService>(),
        },
      ],
      schemas: [],
      // FIXME(PM-18598): Replace unknownElements and unknownProperties with actual imports
      errorOnUnknownElements: false,
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WeakPasswordsReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should initialize component", () => {
    expect(component).toBeTruthy();
  });

  it('should get only ciphers with weak passwords that the user has "Can Edit" access to', async () => {
    const expectedIdOne: any = "cbea34a8-bde4-46ad-9d19-b05001228ab2";
    const expectedIdTwo = "cbea34a8-bde4-46ad-9d19-b05001228cd3";

    jest.spyOn(passwordStrengthService, "getPasswordStrength").mockReturnValue({
      password: "123",
      score: 0,
    } as any);
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
