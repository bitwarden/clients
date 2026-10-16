import { SecretView } from "@bitwarden/bit-common/secrets-manager/models/view/secret.view";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { SmAccessPolicyResponse } from "../models/sm-access-policy.response";
import {
  aliceId,
  bobId,
  createSmAccessFixture,
  groupId,
  groupPolicy,
  machineAccountId,
  machineAccountPolicy,
  potentialGrantee,
  projectId,
  smTargetId,
  userPolicy,
} from "../spec/sm-access-test-utils";
import { smOrgId } from "../spec/sm-test-utils";

import { AccessGrantCommand } from "./access-grant.command";

describe("AccessGrantCommand", () => {
  let fixture: ReturnType<typeof createSmAccessFixture>;
  let command: AccessGrantCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    fixture = createSmAccessFixture();
    command = new AccessGrantCommand(fixture.store);
  });

  describe("project", () => {
    beforeEach(() => {
      fixture.accessPolicyService.getProjectPeopleAccessPolicies.mockResolvedValue({
        userAccessPolicies: [userPolicy(bobId, "Bob", true)],
        groupAccessPolicies: [groupPolicy(groupId, "Engineering")],
      });
      fixture.accessPolicyService.getProjectServiceAccountsAccessPolicies.mockResolvedValue({
        serviceAccountAccessPolicies: [machineAccountPolicy(machineAccountId, "CI runner")],
      });
    });

    it("adds a user by email and preserves existing policies", async () => {
      const response = await command.run(
        smOrgId,
        "project",
        smTargetId,
        "alice@example.com",
        "read",
      );

      expect(response.success).toBe(true);
      expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).toHaveBeenCalledWith(
        smTargetId,
        {
          userAccessPolicies: [
            expect.objectContaining({ organizationUserId: bobId, read: true, write: true }),
            expect.objectContaining({ organizationUserId: aliceId, read: true, write: false }),
          ],
          groupAccessPolicies: [
            expect.objectContaining({ groupId: groupId, read: true, write: false }),
          ],
        },
      );
      expect(
        fixture.accessPolicyService.putProjectServiceAccountsAccessPolicies,
      ).not.toHaveBeenCalled();
    });

    it("changes the permission of an existing grantee without duplicating it", async () => {
      await command.run(smOrgId, "project", smTargetId, "Engineering", "read-write");

      const people = fixture.accessPolicyService.putProjectPeopleAccessPolicies.mock.calls[0][1];
      expect(people.groupAccessPolicies).toEqual([
        expect.objectContaining({ groupId: groupId, read: true, write: true }),
      ]);
      expect(people.userAccessPolicies).toEqual([
        expect.objectContaining({ organizationUserId: bobId, read: true, write: true }),
      ]);
    });

    it("adds a machine account and preserves existing machine accounts", async () => {
      const otherId = "3c3c3c3c-0000-0000-0000-0000000000ff";
      fixture.accessPolicyService.getServiceAccountsPotentialGrantees.mockResolvedValue([
        potentialGrantee("serviceAccount", machineAccountId, "CI runner"),
        potentialGrantee("serviceAccount", otherId, "Deploy bot"),
      ]);

      const response = await command.run(
        smOrgId,
        "project",
        smTargetId,
        "Deploy bot",
        "read-write",
      );

      expect(response.success).toBe(true);
      expect(
        fixture.accessPolicyService.putProjectServiceAccountsAccessPolicies,
      ).toHaveBeenCalledWith(smOrgId, smTargetId, {
        serviceAccountAccessPolicies: [
          expect.objectContaining({ serviceAccountId: machineAccountId, write: false }),
          expect.objectContaining({ serviceAccountId: otherId, read: true, write: true }),
        ],
      });
      expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
    });

    it("returns the policies read back from the server", async () => {
      fixture.accessPolicyService.getProjectPeopleAccessPolicies
        .mockResolvedValueOnce({ userAccessPolicies: [], groupAccessPolicies: [] })
        .mockResolvedValueOnce({
          userAccessPolicies: [userPolicy(aliceId, "Alice")],
          groupAccessPolicies: [],
        });
      fixture.accessPolicyService.getProjectServiceAccountsAccessPolicies.mockResolvedValue({
        serviceAccountAccessPolicies: [],
      });

      const response = await command.run(
        smOrgId,
        "project",
        smTargetId,
        "alice@example.com",
        "read",
      );

      const data = (response.data as ListResponse).data as SmAccessPolicyResponse[];
      expect(data).toEqual([
        expect.objectContaining({
          object: "sm-access-policy",
          type: "user",
          id: aliceId,
          name: "Alice",
          permission: "read",
        }),
      ]);
    });

    it("errors with every candidate when the grantee is ambiguous", async () => {
      fixture.accessPolicyService.getPeoplePotentialGrantees.mockResolvedValue([
        potentialGrantee("group", groupId, "Ops"),
        potentialGrantee("group", "9a9a9a9a-0000-0000-0000-0000000000ff", "ops"),
      ]);

      const response = await command.run(smOrgId, "project", smTargetId, "OPS", "read");

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`OPS` matches more than one grantee. Use the id of one of the following instead:\n" +
          "group " +
          groupId +
          " (Ops)\n" +
          "group 9a9a9a9a-0000-0000-0000-0000000000ff (ops)",
      );
      expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
    });

    it("rejects an invalid permission before calling the server", async () => {
      const response = await command.run(smOrgId, "project", smTargetId, "Engineering", "manage");

      expect(response.message).toBe("`permission` must be one of: read, read-write.");
      expect(fixture.accessPolicyService.getProjectPeopleAccessPolicies).not.toHaveBeenCalled();
    });
  });

  describe("machine-account", () => {
    it("grants a project by name and preserves people access", async () => {
      fixture.accessPolicyService.getServiceAccountPeopleAccessPolicies.mockResolvedValue({
        userAccessPolicies: [userPolicy(bobId, "Bob", true)],
        groupAccessPolicies: [],
      });

      const response = await command.run(smOrgId, "machine-account", smTargetId, "backend", "read");

      expect(response.success).toBe(true);
      expect(fixture.accessPolicyService.putServiceAccountGrantedPolicies).toHaveBeenCalledWith(
        smOrgId,
        smTargetId,
        {
          grantedProjectPolicies: [
            expect.objectContaining({
              accessPolicy: expect.objectContaining({
                grantedProjectId: projectId,
                read: true,
                write: false,
              }),
            }),
          ],
        },
      );
      expect(
        fixture.accessPolicyService.putServiceAccountPeopleAccessPolicies,
      ).not.toHaveBeenCalled();
    });

    it("rejects read-only people access", async () => {
      const response = await command.run(
        smOrgId,
        "machine-account",
        smTargetId,
        "alice@example.com",
        "read",
      );

      expect(response.message).toBe(
        "People can only be granted read-write access to a machine account.",
      );
      expect(
        fixture.accessPolicyService.putServiceAccountPeopleAccessPolicies,
      ).not.toHaveBeenCalled();
    });
  });

  describe("secret", () => {
    it("writes the complete policy set through the secret update request", async () => {
      fixture.accessPolicyService.getSecretAccessPolicies.mockResolvedValue({
        userAccessPolicies: [userPolicy(bobId, "Bob")],
        groupAccessPolicies: [],
        serviceAccountAccessPolicies: [machineAccountPolicy(machineAccountId, "CI runner", true)],
      });

      const response = await command.run(smOrgId, "secret", smTargetId, groupId, "read-write");

      expect(response.success).toBe(true);
      expect(fixture.secretService.update).toHaveBeenCalledWith(
        smOrgId,
        expect.objectContaining({ id: smTargetId, name: "API_KEY", value: "value" }),
        {
          userAccessPolicies: [expect.objectContaining({ organizationUserId: bobId })],
          groupAccessPolicies: [
            expect.objectContaining({ groupId: groupId, read: true, write: true }),
          ],
          serviceAccountAccessPolicies: [
            expect.objectContaining({ serviceAccountId: machineAccountId, write: true }),
          ],
        },
        false,
      );
    });

    it("requires write access to the secret", async () => {
      fixture.secretService.getBySecretId.mockResolvedValue(
        Object.assign(new SecretView(), { id: smTargetId, organizationId: smOrgId, write: false }),
      );

      const response = await command.run(smOrgId, "secret", smTargetId, groupId, "read");

      expect(response.success).toBe(false);
      expect(fixture.secretService.update).not.toHaveBeenCalled();
    });
  });
});
