import { Component, ChangeDetectionStrategy } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import {
  DialogService,
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { CipherFormConfigService, PasswordRepromptService } from "@bitwarden/vault";

import { AdminConsoleCipherFormConfigService } from "../../../vault/org-vault/services/admin-console-cipher-form-config.service";

import { ExposedPasswordsReportComponent } from "./exposed-passwords-report.component";
import { cipherData } from "./reports-ciphers.mock";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-header",
  template: "<div></div>",
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
    await TestBed.configureTestingModule({
      declarations: [
        ExposedPasswordsReportComponent,
        MockHeaderComponent,
        MockBitContainerComponent,
      ],
      imports: [I18nPipe, AsyncActionsModule, ButtonModule, FormFieldModule],
      providers: [
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
          provide: CipherFormConfigService,
          useValue: cipherFormConfigServiceMock,
        },
        {
          provide: AdminConsoleCipherFormConfigService,
          useValue: adminConsoleCipherFormConfigServiceMock,
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
});
