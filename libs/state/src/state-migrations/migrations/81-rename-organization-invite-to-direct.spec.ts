import { runMigrator } from "../migration-helper.spec";
import { IRREVERSIBLE } from "../migrator";

import { RenameOrganizationInviteToDirect } from "./81-rename-organization-invite-to-direct";

describe("RenameOrganizationInviteToDirect", () => {
  const sut = new RenameOrganizationInviteToDirect(80, 81);

  describe("migrate", () => {
    it("moves an existing stashed invite to the new key and removes the old key", async () => {
      const stashed = {
        email: "user@example.com",
        initOrganization: false,
        orgUserHasExistingUser: true,
        organizationId: "00000000-0000-0000-0000-000000000001",
        organizationName: "Acme Corp",
        organizationUserId: "00000000-0000-0000-0000-000000000002",
        token: "abc",
      };

      const output = await runMigrator(sut, {
        global_organizationInvite_organizationInvite: stashed,
      });

      expect(output).toEqual({
        global_organizationInvite_directOrganizationInvite: stashed,
      });
    });

    it("preserves the stashed value byte-for-byte (no field loss or coercion)", async () => {
      // Includes optional orgSsoIdentifier to verify it survives.
      const stashed = {
        email: "user@example.com",
        initOrganization: true,
        orgSsoIdentifier: "sso-identifier",
        orgUserHasExistingUser: false,
        organizationId: "00000000-0000-0000-0000-000000000001",
        organizationName: "Acme Corp",
        organizationUserId: "00000000-0000-0000-0000-000000000002",
        token: "abc",
      };

      const output = await runMigrator(sut, {
        global_organizationInvite_organizationInvite: stashed,
      });

      expect(output.global_organizationInvite_directOrganizationInvite).toEqual(stashed);
    });

    it("is a no-op when no invite is stashed (new key remains absent; no null written)", async () => {
      const output = await runMigrator(sut, {});

      expect(output).toEqual({});
    });
  });

  describe("rollback", () => {
    it("is irreversible", async () => {
      await expect(runMigrator(sut, {}, "rollback")).rejects.toThrow(IRREVERSIBLE);
    });
  });
});
