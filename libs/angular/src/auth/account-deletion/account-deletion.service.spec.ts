import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

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
import { DeleteAccountDialogComponent } from "./delete-account-dialog/delete-account-dialog.component";

// isOwner is a computed getter (reads from type), so set type directly
function makeOrg(overrides: Partial<Organization> = {}): Organization {
  const org = new Organization();
  org.type = OrganizationUserType.Owner;
  org.isMember = true;
  org.status = OrganizationUserStatusType.Confirmed;
  org.productTierType = ProductTierType.Free;
  org.userIsClaimedByOrganization = false;
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

  describe("when the user is claimed by an organization", () => {
    beforeEach(() => {
      organizations$.next([makeOrg({ userIsClaimedByOrganization: true })]);
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

  describe("owner filter edge cases", () => {
    it("does not gate a provider-only owner (isMember = false)", async () => {
      // An owner who accesses the org via provider, not as a member, should not be blocked
      organizations$.next([
        makeOrg({ isMember: false, productTierType: ProductTierType.Enterprise }),
      ]);

      await service.openDeleteAccountFlow();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(DeleteAccountDialogComponent.open).toHaveBeenCalled();
    });

    it.each([
      OrganizationUserStatusType.Invited,
      OrganizationUserStatusType.Accepted,
      OrganizationUserStatusType.Revoked,
    ])("does not gate an owner whose status is %s (not Confirmed)", async (status) => {
      organizations$.next([makeOrg({ status, productTierType: ProductTierType.Enterprise })]);

      await service.openDeleteAccountFlow();

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(DeleteAccountDialogComponent.open).toHaveBeenCalled();
    });
  });

  describe("paid-tier coverage", () => {
    it.each([
      ProductTierType.TeamsStarter,
      ProductTierType.Teams,
      ProductTierType.Families,
      ProductTierType.Enterprise,
    ])("blocks deletion for productTierType %s", async (tierType) => {
      organizations$.next([makeOrg({ productTierType: tierType })]);

      await service.openDeleteAccountFlow();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "cannotDeleteAccountOrganizationOwnerDesc" } }),
      );
      expect(DeleteAccountDialogComponent.open).not.toHaveBeenCalled();
    });
  });

  describe("mixed-org priority", () => {
    it("shows the paid-org blocking dialog when the user owns both a free and a paid org", async () => {
      organizations$.next([
        makeOrg({ productTierType: ProductTierType.Free }),
        makeOrg({ productTierType: ProductTierType.Enterprise }),
      ]);

      await service.openDeleteAccountFlow();

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(
        expect.objectContaining({ content: { key: "cannotDeleteAccountOrganizationOwnerDesc" } }),
      );
      expect(DeleteAccountDialogComponent.open).not.toHaveBeenCalled();
    });
  });
});
