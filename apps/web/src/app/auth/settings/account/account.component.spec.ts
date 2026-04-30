import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { DeleteAccountDialogComponent } from "@bitwarden/angular/auth/delete-account-dialog/delete-account-dialog.component";
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";

import { AccountComponent } from "./account.component";

// isOwner is a computed getter (type === Owner), so set type directly
function makeOrg(overrides: Partial<Organization> = {}): Organization {
  const org = new Organization();
  org.type = OrganizationUserType.Owner;
  org.isMember = true;
  org.status = OrganizationUserStatusType.Confirmed;
  org.productTierType = ProductTierType.Free;
  Object.assign(org, overrides);
  return org;
}

describe("AccountComponent", () => {
  let component: AccountComponent;
  let fixture: ComponentFixture<AccountComponent>;

  let dialogService: MockProxy<DialogService>;
  let organizationService: MockProxy<OrganizationService>;
  let organizations$: BehaviorSubject<Organization[]>;

  const mockUserId = "test-user-id" as UserId;
  const mockDeleteDialogRef = { closed: of(undefined) } as unknown as DialogRef;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    dialogService = mock<DialogService>();
    organizationService = mock<OrganizationService>();
    organizations$ = new BehaviorSubject<Organization[]>([]);

    organizationService.organizations$.mockReturnValue(organizations$);
    dialogService.openSimpleDialog.mockResolvedValue(false);
    jest.spyOn(DeleteAccountDialogComponent, "open").mockReturnValue(mockDeleteDialogRef);

    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        { provide: AccountService, useValue: mockAccountServiceWith(mockUserId) },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: { hasMasterPasswordById$: () => of(true) },
        },
        { provide: OrganizationService, useValue: organizationService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    })
      .overrideProvider(DialogService, { useValue: dialogService })
      .overrideComponent(AccountComponent, { set: { template: "" } })
      .compileComponents();

    fixture = TestBed.createComponent(AccountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe("deleteAccount", () => {
    describe("when the user owns a paid organization", () => {
      beforeEach(() => {
        organizations$.next([makeOrg({ productTierType: ProductTierType.Enterprise })]);
      });

      it("shows a blocking error dialog", async () => {
        await component.deleteAccount();

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({ content: { key: "cannotDeleteAccountOrganizationOwnerDesc" } }),
        );
      });

      it("does not open the delete account dialog", async () => {
        await component.deleteAccount();

        expect(DeleteAccountDialogComponent.open).not.toHaveBeenCalled();
      });
    });

    describe("when the user owns a free organization", () => {
      beforeEach(() => {
        organizations$.next([makeOrg({ productTierType: ProductTierType.Free })]);
      });

      it("shows a warning dialog", async () => {
        await component.deleteAccount();

        expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
          expect.objectContaining({
            content: { key: "deleteAccountOrganizationOwnerWarning" },
          }),
        );
      });

      it("proceeds to the delete account dialog when the user confirms", async () => {
        dialogService.openSimpleDialog.mockResolvedValue(true);

        await component.deleteAccount();

        expect(DeleteAccountDialogComponent.open).toHaveBeenCalled();
      });

      it("does not open the delete account dialog when the user cancels", async () => {
        dialogService.openSimpleDialog.mockResolvedValue(false);

        await component.deleteAccount();

        expect(DeleteAccountDialogComponent.open).not.toHaveBeenCalled();
      });
    });

    describe("when the user does not own any organizations", () => {
      beforeEach(() => {
        organizations$.next([]);
      });

      it("opens the delete account dialog directly", async () => {
        await component.deleteAccount();

        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        expect(DeleteAccountDialogComponent.open).toHaveBeenCalled();
      });
    });

    describe("when the user is an org member but not owner", () => {
      beforeEach(() => {
        organizations$.next([makeOrg({ type: OrganizationUserType.Admin })]);
      });

      it("opens the delete account dialog directly", async () => {
        await component.deleteAccount();

        expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
        expect(DeleteAccountDialogComponent.open).toHaveBeenCalled();
      });
    });
  });
});
