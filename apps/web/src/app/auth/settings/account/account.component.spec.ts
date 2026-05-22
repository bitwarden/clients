import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountDeletionService } from "@bitwarden/angular/auth/account-deletion/account-deletion.service";
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { AccountComponent } from "./account.component";

describe("AccountComponent", () => {
  let component: AccountComponent;
  let fixture: ComponentFixture<AccountComponent>;

  let accountDeletionService: MockProxy<AccountDeletionService>;

  const mockUserId = "test-user-id" as UserId;

  beforeEach(async () => {
    accountDeletionService = mock<AccountDeletionService>();
    accountDeletionService.openDeleteAccountFlow.mockResolvedValue();

    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        { provide: AccountService, useValue: mockAccountServiceWith(mockUserId) },
        { provide: DialogService, useValue: mock<DialogService>() },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: { hasMasterPasswordById$: () => of(true) },
        },
        { provide: OrganizationService, useValue: mock<OrganizationService>() },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideProvider(AccountDeletionService, { useValue: accountDeletionService })
      .overrideComponent(AccountComponent, { set: { template: "" } })
      .compileComponents();

    fixture = TestBed.createComponent(AccountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("deleteAccount", () => {
    it("delegates to AccountDeletionService", async () => {
      await component.deleteAccount();

      expect(accountDeletionService.openDeleteAccountFlow).toHaveBeenCalledTimes(1);
    });
  });
});
