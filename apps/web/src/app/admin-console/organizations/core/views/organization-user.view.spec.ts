import {
  OrganizationUserStatusType,
  OrganizationUserType,
  RevocationReasonType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Guid, UserId } from "@bitwarden/common/types/guid";

import { OrganizationUserView } from "./organization-user.view";

function createMember(
  status: OrganizationUserStatusType,
  claimedByOrganization = false,
  type: OrganizationUserType = OrganizationUserType.User,
): OrganizationUserView {
  return new OrganizationUserView({
    id: "org-user-id" as Guid,
    userId: "user-id" as UserId,
    email: "member@example.com",
    type,
    revocationReason: RevocationReasonType.Unknown,
    status,
    permissions: new PermissionsApi(),
    avatarColor: "#175ddc",
    name: "Member",
    claimedByOrganization,
  });
}

describe("OrganizationUserView", () => {
  describe("canConfirm", () => {
    it("is true for accepted members", () => {
      expect(createMember(OrganizationUserStatusType.Accepted).canConfirm).toBe(true);
    });

    it.each([
      ["invited", OrganizationUserStatusType.Invited],
      ["confirmed", OrganizationUserStatusType.Confirmed],
      ["revoked", OrganizationUserStatusType.Revoked],
      ["staged", OrganizationUserStatusType.Staged],
    ])("is false for %s members", (_, status) => {
      expect(createMember(status).canConfirm).toBe(false);
    });
  });

  describe("canReinvite", () => {
    it("is true for invited members", () => {
      expect(createMember(OrganizationUserStatusType.Invited).canReinvite).toBe(true);
    });

    it("is false for staged members", () => {
      expect(createMember(OrganizationUserStatusType.Staged).canReinvite).toBe(false);
    });
  });

  describe("canSendInvite", () => {
    it("is true for staged members", () => {
      expect(createMember(OrganizationUserStatusType.Staged).canSendInvite).toBe(true);
    });

    it.each([
      ["invited", OrganizationUserStatusType.Invited],
      ["accepted", OrganizationUserStatusType.Accepted],
      ["confirmed", OrganizationUserStatusType.Confirmed],
      ["revoked", OrganizationUserStatusType.Revoked],
    ])("is false for %s members", (_, status) => {
      expect(createMember(status).canSendInvite).toBe(false);
    });
  });

  describe("canRestore", () => {
    it("is true for revoked members", () => {
      expect(createMember(OrganizationUserStatusType.Revoked).canRestore).toBe(true);
    });

    it("is false for staged members", () => {
      expect(createMember(OrganizationUserStatusType.Staged).canRestore).toBe(false);
    });
  });

  describe("canRevoke", () => {
    it.each([
      ["invited", OrganizationUserStatusType.Invited],
      ["accepted", OrganizationUserStatusType.Accepted],
      ["confirmed", OrganizationUserStatusType.Confirmed],
      ["staged", OrganizationUserStatusType.Staged],
    ])("is true for %s members", (_, status) => {
      expect(createMember(status).canRevoke).toBe(true);
    });

    it("is false for already revoked members", () => {
      expect(createMember(OrganizationUserStatusType.Revoked).canRevoke).toBe(false);
    });
  });

  describe("canRemove", () => {
    it("is true for members not claimed by the organization", () => {
      expect(createMember(OrganizationUserStatusType.Staged, false).canRemove).toBe(true);
    });

    it("is false for members claimed by the organization", () => {
      expect(createMember(OrganizationUserStatusType.Confirmed, true).canRemove).toBe(false);
    });
  });

  describe("isSelf", () => {
    it("is true when the member is the signed-in admin", () => {
      const organization = createOrganization({ userId: "user-id" });

      expect(createMember(OrganizationUserStatusType.Confirmed).isSelf(organization)).toBe(true);
    });

    it("is false for another member", () => {
      const organization = createOrganization({ userId: "other-user-id" });

      expect(createMember(OrganizationUserStatusType.Confirmed).isSelf(organization)).toBe(false);
    });

    it("is false for a member without an account, such as a staged one", () => {
      const member = new OrganizationUserView({
        ...memberInit(),
        userId: null as unknown as UserId,
      });
      const organization = createOrganization({ userId: null as unknown as string });

      expect(member.isSelf(organization)).toBe(false);
    });
  });

  describe("canBeActedOnBy", () => {
    const owner = createOrganization({ type: OrganizationUserType.Owner });
    const admin = createOrganization({ type: OrganizationUserType.Admin });
    const custom = createOrganization({ type: OrganizationUserType.Custom });
    const provider = createOrganization({
      type: OrganizationUserType.User,
      isProviderUser: true,
    });

    it.each([
      ["an Owner", owner, true],
      ["a Provider user", provider, true],
      ["an Admin", admin, false],
      ["a Custom user", custom, false],
    ])("lets %s act on an Owner: %s", (_, organization, expected) => {
      const member = createMember(
        OrganizationUserStatusType.Confirmed,
        false,
        OrganizationUserType.Owner,
      );

      expect(member.canBeActedOnBy(organization)).toBe(expected);
    });

    it.each([
      ["an Owner", owner, true],
      ["a Provider user", provider, true],
      ["an Admin", admin, true],
      ["a Custom user", custom, false],
    ])("lets %s act on an Admin: %s", (_, organization, expected) => {
      const member = createMember(
        OrganizationUserStatusType.Confirmed,
        false,
        OrganizationUserType.Admin,
      );

      expect(member.canBeActedOnBy(organization)).toBe(expected);
    });

    it.each([
      ["User", OrganizationUserType.User],
      ["Custom", OrganizationUserType.Custom],
    ])("lets a Custom user act on a %s", (_, type) => {
      const member = createMember(OrganizationUserStatusType.Confirmed, false, type);

      expect(member.canBeActedOnBy(custom)).toBe(true);
    });
  });

  describe("canRestoreAccess", () => {
    it("is true for a revoked member the admin outranks", () => {
      const member = createMember(OrganizationUserStatusType.Revoked);

      expect(member.canRestoreAccess(createOrganization())).toBe(true);
    });

    it("is false when an Admin selects a revoked Owner", () => {
      const member = createMember(
        OrganizationUserStatusType.Revoked,
        false,
        OrganizationUserType.Owner,
      );

      expect(
        member.canRestoreAccess(createOrganization({ type: OrganizationUserType.Admin })),
      ).toBe(false);
    });

    it("is false when a Custom user selects a revoked Admin", () => {
      const member = createMember(
        OrganizationUserStatusType.Revoked,
        false,
        OrganizationUserType.Admin,
      );

      expect(
        member.canRestoreAccess(createOrganization({ type: OrganizationUserType.Custom })),
      ).toBe(false);
    });

    it("is false for a member who isn't revoked", () => {
      const member = createMember(OrganizationUserStatusType.Confirmed);

      expect(member.canRestoreAccess(createOrganization())).toBe(false);
    });
  });

  describe("canRevokeAccess", () => {
    it("is true for an active member the admin outranks", () => {
      expect(
        createMember(OrganizationUserStatusType.Confirmed).canRevokeAccess(createOrganization()),
      ).toBe(true);
    });

    it("is false for an already revoked member", () => {
      expect(
        createMember(OrganizationUserStatusType.Revoked).canRevokeAccess(createOrganization()),
      ).toBe(false);
    });

    it("is false for an Owner when the admin isn't one", () => {
      const member = createMember(
        OrganizationUserStatusType.Confirmed,
        false,
        OrganizationUserType.Owner,
      );

      expect(member.canRevokeAccess(createOrganization({ type: OrganizationUserType.Admin }))).toBe(
        false,
      );
    });
  });

  describe("canRemoveFromOrg", () => {
    it("is true for an unclaimed member the admin outranks", () => {
      expect(
        createMember(OrganizationUserStatusType.Confirmed).canRemoveFromOrg(createOrganization()),
      ).toBe(true);
    });

    it("is false for a claimed member", () => {
      expect(
        createMember(OrganizationUserStatusType.Confirmed, true).canRemoveFromOrg(
          createOrganization(),
        ),
      ).toBe(false);
    });
  });

  describe("canDeleteAccount", () => {
    it.each([
      ["accepted", OrganizationUserStatusType.Accepted],
      ["confirmed", OrganizationUserStatusType.Confirmed],
      ["revoked", OrganizationUserStatusType.Revoked],
    ])("is true for a claimed %s member", (_, status) => {
      expect(createMember(status, true).canDeleteAccount(createOrganization())).toBe(true);
    });

    it.each([
      ["staged", OrganizationUserStatusType.Staged],
      ["invited", OrganizationUserStatusType.Invited],
    ])("is false for a claimed %s member", (_, status) => {
      expect(createMember(status, true).canDeleteAccount(createOrganization())).toBe(false);
    });

    it("is false for an unclaimed member", () => {
      expect(
        createMember(OrganizationUserStatusType.Confirmed).canDeleteAccount(createOrganization()),
      ).toBe(false);
    });

    it("is false for a claimed Owner when the admin isn't one", () => {
      const member = createMember(
        OrganizationUserStatusType.Confirmed,
        true,
        OrganizationUserType.Owner,
      );

      expect(
        member.canDeleteAccount(createOrganization({ type: OrganizationUserType.Admin })),
      ).toBe(false);
    });
  });

  describe("canAddToSecretsManager", () => {
    it("is true when the organization uses Secrets Manager and the member lacks access", () => {
      const member = createMember(OrganizationUserStatusType.Confirmed);

      expect(member.canAddToSecretsManager(createOrganization({ useSecretsManager: true }))).toBe(
        true,
      );
    });

    it("is false when the organization doesn't use Secrets Manager", () => {
      const member = createMember(OrganizationUserStatusType.Confirmed);

      expect(member.canAddToSecretsManager(createOrganization({ useSecretsManager: false }))).toBe(
        false,
      );
    });

    it("is false when the member already has access", () => {
      const member = createMember(OrganizationUserStatusType.Confirmed);
      member.accessSecretsManager = true;

      expect(member.canAddToSecretsManager(createOrganization({ useSecretsManager: true }))).toBe(
        false,
      );
    });

    it("is false for a revoked member", () => {
      const member = createMember(OrganizationUserStatusType.Revoked);

      expect(member.canAddToSecretsManager(createOrganization({ useSecretsManager: true }))).toBe(
        false,
      );
    });
  });

  describe("canAddToPrivilegedControls", () => {
    it("is true when the organization uses Privileged Controls and the member lacks access", () => {
      const member = createMember(OrganizationUserStatusType.Confirmed);

      expect(member.canAddToPrivilegedControls(createOrganization({ usePam: true }))).toBe(true);
    });

    it("is false when the organization doesn't use Privileged Controls", () => {
      const member = createMember(OrganizationUserStatusType.Confirmed);

      expect(member.canAddToPrivilegedControls(createOrganization({ usePam: false }))).toBe(false);
    });

    it("is false when the member already has access", () => {
      const member = createMember(OrganizationUserStatusType.Confirmed);
      member.accessPam = true;

      expect(member.canAddToPrivilegedControls(createOrganization({ usePam: true }))).toBe(false);
    });

    it("is false for a revoked member", () => {
      const member = createMember(OrganizationUserStatusType.Revoked);

      expect(member.canAddToPrivilegedControls(createOrganization({ usePam: true }))).toBe(false);
    });
  });
});

function memberInit() {
  return {
    id: "org-user-id" as Guid,
    userId: "user-id" as UserId,
    email: "member@example.com",
    type: OrganizationUserType.User,
    revocationReason: RevocationReasonType.Unknown,
    status: OrganizationUserStatusType.Confirmed,
    permissions: new PermissionsApi(),
    avatarColor: "#175ddc",
    name: "Member",
  };
}

/** An organization as seen by an Owner unless overridden. `isOwner` follows the real getter. */
function createOrganization(overrides: Partial<Organization> = {}): Organization {
  return Object.assign(Object.create(Organization.prototype) as Organization, {
    userId: "admin-user-id",
    type: OrganizationUserType.Owner,
    isProviderUser: false,
    useSecretsManager: false,
    usePam: false,
    ...overrides,
  });
}
