import { ProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/project.view";

import { aliceId, createSmAccessFixture, groupId, smTargetId } from "../spec/sm-access-test-utils";
import { mockSmOrganization, smNotFoundError, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

import {
  checkSmAccessPolicy,
  fromSmPermission,
  parseSmPermission,
  resolveSmGrantee,
  toSmPermission,
} from "./sm-access-policies";

describe("sm access policies", () => {
  describe("permission mapping", () => {
    it("maps read to read-only flags", () => {
      expect(fromSmPermission("read")).toEqual({ read: true, write: false });
    });

    it("maps read-write to read and write flags", () => {
      expect(fromSmPermission("read-write")).toEqual({ read: true, write: true });
    });

    it.each([
      [{ read: true, write: false }, "read"],
      [{ read: true, write: true }, "read-write"],
    ])("maps %o to %s", (flags, permission) => {
      expect(toSmPermission(flags)).toBe(permission);
    });

    it.each(["manage", "write", "", undefined])("rejects the permission %p", (permission) => {
      const result = parseSmPermission(permission);

      expect(result.error?.success).toBe(false);
      expect(result.error?.message).toBe("`permission` must be one of: read, read-write.");
    });
  });

  describe("checkSmAccessPolicy", () => {
    it("rejects read-only people access to a machine account", () => {
      expect(checkSmAccessPolicy("machine-account", "user", "read")?.message).toBe(
        "People can only be granted read-write access to a machine account.",
      );
    });

    it("allows read-only project access for a machine account", () => {
      expect(checkSmAccessPolicy("machine-account", "project", "read")).toBeUndefined();
    });

    it("rejects a grantee type the target does not support", () => {
      expect(checkSmAccessPolicy("project", "project", "read")?.message).toBe(
        "A project cannot be granted access to a project. Expected one of: user, group, machineAccount.",
      );
    });
  });

  describe("resolveSmGrantee", () => {
    const candidates = [
      { type: "user" as const, id: aliceId, email: "alice@example.com" },
      { type: "group" as const, id: groupId, name: "Alice" },
      { type: "machineAccount" as const, id: "5e5e5e5e-0000-0000-0000-000000000001", name: "CI" },
      { type: "machineAccount" as const, id: "5e5e5e5e-0000-0000-0000-000000000002", name: "ci" },
    ];

    it("resolves a user by email, ignoring case", () => {
      expect(resolveSmGrantee("Alice@Example.com", candidates, "project").grantee?.id).toBe(
        aliceId,
      );
    });

    it("resolves a group by name", () => {
      expect(resolveSmGrantee("alice", candidates, "project").grantee?.id).toBe(groupId);
    });

    it("prefers an id match over a name match", () => {
      expect(resolveSmGrantee(groupId.toUpperCase(), candidates, "project").grantee?.type).toBe(
        "group",
      );
    });

    it("lists every candidate when the grantee is ambiguous", () => {
      const result = resolveSmGrantee("CI", candidates, "project");

      expect(result.error?.success).toBe(false);
      expect(result.error?.message).toBe(
        "`CI` matches more than one grantee. Use the id of one of the following instead:\n" +
          "machine account 5e5e5e5e-0000-0000-0000-000000000001 (CI)\n" +
          "machine account 5e5e5e5e-0000-0000-0000-000000000002 (ci)",
      );
    });

    it("errors when nothing matches", () => {
      const result = resolveSmGrantee("nobody", candidates, "project");

      expect(result.error?.message).toBe(
        "No user, group, or machine account matching `nobody` can be granted access to this project. " +
          "Use `bw sm grantees list` to see the available grantees.",
      );
    });
  });

  describe("SmAccessPolicyStore.load", () => {
    it("rejects a target in another organization", async () => {
      const { store, projectService, accessPolicyService } = createSmAccessFixture();
      projectService.getByProjectId.mockResolvedValue(
        Object.assign(new ProjectView(), { id: smTargetId, organizationId: smOtherOrgId }),
      );

      const result = await store.load(smOrgId, "project", smTargetId);

      expect(result.error?.message).toBe(
        "The project was not found, or you do not have access to it.",
      );
      expect(accessPolicyService.getProjectPeopleAccessPolicies).not.toHaveBeenCalled();
    });

    it("maps a 404 to a not found error", async () => {
      const { store, serviceAccountService } = createSmAccessFixture();
      serviceAccountService.getByServiceAccountId.mockRejectedValue(smNotFoundError());

      const result = await store.load(smOrgId, "machine-account", smTargetId);

      expect(result.error?.message).toBe(
        "The machine account was not found, or you do not have access to it.",
      );
    });

    it("rejects an unknown target", async () => {
      const { store } = createSmAccessFixture();

      const result = await store.load(smOrgId, "folder", smTargetId);

      expect(result.error?.message).toBe(
        "Unknown access target `folder`. Expected one of: project, machine-account, secret.",
      );
    });

    it("requires Secrets Manager access", async () => {
      const { store, accountService, organizationService } = createSmAccessFixture();
      mockSmOrganization(accountService, organizationService, false);

      const result = await store.load(smOrgId, "project", smTargetId);

      expect(result.error?.message).toBe(
        "You do not have access to Secrets Manager for this organization.",
      );
    });
  });
});
