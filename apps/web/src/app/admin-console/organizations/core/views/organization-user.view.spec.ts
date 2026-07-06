import {
  OrganizationUserStatusType,
  OrganizationUserType,
  RevocationReasonType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Guid, UserId } from "@bitwarden/common/types/guid";

import { OrganizationUserView } from "./organization-user.view";

function createMember(
  status: OrganizationUserStatusType,
  claimedByOrganization = false,
): OrganizationUserView {
  return new OrganizationUserView({
    id: "org-user-id" as Guid,
    userId: "user-id" as UserId,
    email: "member@example.com",
    type: OrganizationUserType.User,
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

  describe("canManageMember", () => {
    it("is false for staged members so only Revoke and Remove remain", () => {
      expect(createMember(OrganizationUserStatusType.Staged).canManageMember).toBe(false);
    });

    it.each([
      ["invited", OrganizationUserStatusType.Invited],
      ["accepted", OrganizationUserStatusType.Accepted],
      ["confirmed", OrganizationUserStatusType.Confirmed],
      ["revoked", OrganizationUserStatusType.Revoked],
    ])("is true for %s members", (_, status) => {
      expect(createMember(status).canManageMember).toBe(true);
    });
  });
});
