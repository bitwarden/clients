import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { DeleteAccountDialogComponent } from "@bitwarden/angular/auth/delete-account-dialog/delete-account-dialog.component";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService } from "@bitwarden/components";

import { AccountDeletionService } from "./account-deletion.service";

// isOwner is a computed getter (reads from type), so set type directly
function makeOrg(overrides: Partial<Organization> = {}): Organization {
  const org = new Organization();
  org.type = OrganizationUserType.Owner;
  org.isMember = true;
  org.status = OrganizationUserStatusType.Confirmed;
  org.productTierType = ProductTierType.Free;
  org.userIsManagedByOrganization = false;
  Object.assign(org, overrides);
  return org;
}

describe("AccountDeletionService", () => {
  let service: AccountDeletionService;

  let accountService: FakeAccountService;
  let organizationService: MockProxy<OrganizationService>;
  let dialogService: MockProxy<DialogService>;
  let organizations$: BehaviorSubject<Organization[]>;

  const mockUserId = "test-user-id" as UserId;
  const mockDeleteDialogRef = { closed: of(undefined) } as unknown as DialogRef<
    unknown,
    DeleteAccountDialogComponent
  >;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    organizationService = mock<OrganizationService>();
    dialogService = mock<DialogService>();
    organizations$ = new BehaviorSubject<Organization[]>([]);

    organizationService.organizations$.mockReturnValue(organizations$);
    dialogService.openSimpleDialog.mockResolvedValue(false);
    jest.spyOn(DeleteAccountDialogComponent, "open").mockReturnValue(mockDeleteDialogRef);

    service = new AccountDeletionService(accountService, organizationService, dialogService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("when the user is managed by an organization", () => {
    beforeEach(() => {
      organizations$.next([makeOrg({ userIsManagedByOrganization: true })]);
    });

    it("shows a blocking error dialog", async () => {
      await service.openDeleteAccountFlow();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "cannotDeleteAccountDesc" } }),
      );
    });

    it("does not open the delete account dialog", async () => {
      await service.openDeleteAccountFlow();

      expect(DeleteAccountDialogComponent.open).not.toHaveBeenCalled();
    });
  });

  describe("when the user owns a paid organization", () => {
    beforeEach(() => {
      organizations$.next([makeOrg({ productTierType: ProductTierType.Enterprise })]);
    });

    it("shows a blocking error dialog", async () => {
      await service.openDeleteAccountFlow();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "cannotDeleteAccountOrganizationOwnerDesc" } }),
      );
    });

    it("does not open the delete account dialog", async () => {
      await service.openDeleteAccountFlow();

      expect(DeleteAccountDialogComponent.open).not.toHaveBeenCalled();
    });
  });

  describe("when the user owns a free organization", () => {
    beforeEach(() => {
      organizations$.next([makeOrg({ productTierType: ProductTierType.Free })]);
    });

    it("shows a warning dialog", async () => {
      await service.openDeleteAccountFlow();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "deleteAccountOrganizationOwnerWarning" } }),
      );
    });

    it("proceeds to the delete account dialog when the user confirms", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.openDeleteAccountFlow();

      expect(DeleteAccountDialogComponent.open).toHaveBeenCalled();
    });

    it("does not open the delete account dialog when the user cancels", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await service.openDeleteAccountFlow();

      expect(DeleteAccountDialogComponent.open).not.toHaveBeenCalled();
    });
  });

  describe("when the user does not own any organizations", () => {
    beforeEach(() => {
      organizations$.next([]);
    });

    it("opens the delete account dialog directly", async () => {
      await service.openDeleteAccountFlow();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(DeleteAccountDialogComponent.open).toHaveBeenCalled();
    });
  });

  describe("when the user is an org member but not owner", () => {
    beforeEach(() => {
      organizations$.next([makeOrg({ type: OrganizationUserType.Admin })]);
    });

    it("opens the delete account dialog directly", async () => {
      await service.openDeleteAccountFlow();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(DeleteAccountDialogComponent.open).toHaveBeenCalled();
    });
  });
});
