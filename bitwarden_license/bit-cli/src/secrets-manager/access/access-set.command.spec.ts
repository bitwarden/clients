import {
  aliceId,
  bobId,
  createSmAccessFixture,
  groupId,
  machineAccountId,
  machineAccountPolicy,
  smTargetId,
  userPolicy,
} from "../spec/sm-access-test-utils";
import { encodeSmRequest, smOrgId, smOtherOrgId, smOrg } from "../spec/sm-test-utils";

import { AccessSetCommand } from "./access-set.command";

describe("AccessSetCommand", () => {
  let fixture: ReturnType<typeof createSmAccessFixture>;
  let command: AccessSetCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    fixture = createSmAccessFixture();
    command = new AccessSetCommand(fixture.store);
    fixture.accessPolicyService.getProjectPeopleAccessPolicies.mockResolvedValue({
      userAccessPolicies: [userPolicy(bobId, "Bob", true)],
      groupAccessPolicies: [],
    });
    fixture.accessPolicyService.getProjectServiceAccountsAccessPolicies.mockResolvedValue({
      serviceAccountAccessPolicies: [machineAccountPolicy(machineAccountId, "CI runner")],
    });
  });

  it("replaces every policy on the target", async () => {
    const response = await command.run(
      smOrg,
      "project",
      smTargetId,
      encodeSmRequest({
        policies: [
          { type: "user", id: aliceId.toUpperCase(), permission: "read" },
          { type: "group", id: groupId, permission: "read-write" },
        ],
      }),
    );

    expect(response.success).toBe(true);
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).toHaveBeenCalledWith(
      smTargetId,
      {
        userAccessPolicies: [
          expect.objectContaining({ organizationUserId: aliceId, read: true, write: false }),
        ],
        groupAccessPolicies: [
          expect.objectContaining({ groupId: groupId, read: true, write: true }),
        ],
      },
    );
    expect(
      fixture.accessPolicyService.putProjectServiceAccountsAccessPolicies,
    ).toHaveBeenCalledWith(smOrgId, smTargetId, { serviceAccountAccessPolicies: [] });
  });

  it.each([undefined, null])(
    "keeps a grantee's existing permission when `permission` is %s",
    async (permission) => {
      const response = await command.run(smOrg, "project", smTargetId, {
        policies: [
          { type: "user", id: bobId.toUpperCase(), permission },
          { type: "user", id: aliceId, permission: "read" },
        ],
      });

      expect(response.success).toBe(true);
      expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).toHaveBeenCalledWith(
        smTargetId,
        {
          userAccessPolicies: [
            expect.objectContaining({ organizationUserId: bobId, read: true, write: true }),
            expect.objectContaining({ organizationUserId: aliceId, read: true, write: false }),
          ],
          groupAccessPolicies: [],
        },
      );
    },
  );

  it("does not rewrite policies when only the permission is left out", async () => {
    const response = await command.run(smOrg, "project", smTargetId, {
      policies: [
        { type: "user", id: bobId },
        { type: "machineAccount", id: machineAccountId },
      ],
    });

    expect(response.success).toBe(true);
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
    expect(
      fixture.accessPolicyService.putProjectServiceAccountsAccessPolicies,
    ).not.toHaveBeenCalled();
  });

  it("uses an explicit permission over the existing one", async () => {
    const response = await command.run(smOrg, "project", smTargetId, {
      policies: [{ type: "user", id: bobId, permission: "read" }],
    });

    expect(response.success).toBe(true);
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).toHaveBeenCalledWith(
      smTargetId,
      {
        userAccessPolicies: [
          expect.objectContaining({ organizationUserId: bobId, read: true, write: false }),
        ],
        groupAccessPolicies: [],
      },
    );
  });

  it("grants read access to a new grantee when `permission` is left out", async () => {
    const response = await command.run(smOrg, "project", smTargetId, {
      policies: [{ type: "group", id: groupId }],
    });

    expect(response.success).toBe(true);
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).toHaveBeenCalledWith(
      smTargetId,
      {
        userAccessPolicies: [],
        groupAccessPolicies: [
          expect.objectContaining({ groupId: groupId, read: true, write: false }),
        ],
      },
    );
  });

  it("keeps existing people access to a machine account when `permission` is left out", async () => {
    fixture.accessPolicyService.getServiceAccountPeopleAccessPolicies.mockResolvedValue({
      userAccessPolicies: [userPolicy(bobId, "Bob", true)],
      groupAccessPolicies: [],
    });

    const response = await command.run(smOrg, "machine-account", smTargetId, {
      policies: [{ type: "user", id: bobId }],
    });

    expect(response.success).toBe(true);
    expect(
      fixture.accessPolicyService.putServiceAccountPeopleAccessPolicies,
    ).not.toHaveBeenCalled();
  });

  it("rejects a new person on a machine account when `permission` is left out", async () => {
    const response = await command.run(smOrg, "machine-account", smTargetId, {
      policies: [{ type: "user", id: aliceId }],
    });

    expect(response.message).toBe(
      "People can only be granted read-write access to a machine account.",
    );
    expect(
      fixture.accessPolicyService.putServiceAccountPeopleAccessPolicies,
    ).not.toHaveBeenCalled();
  });

  it("accepts an object body from bw serve", async () => {
    const response = await command.run(smOrg, "project", smTargetId, {
      organizationId: smOrgId,
      policies: [{ type: "machineAccount", id: machineAccountId, permission: "read" }],
    });

    expect(response.success).toBe(true);
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).toHaveBeenCalledWith(
      smTargetId,
      { userAccessPolicies: [], groupAccessPolicies: [] },
    );
    expect(
      fixture.accessPolicyService.putProjectServiceAccountsAccessPolicies,
    ).not.toHaveBeenCalled();
  });

  it.each([
    [{}, "`policies` must be an array."],
    [{ policies: ["x"] }, "Each policy must be a JSON object."],
    [
      { policies: [{ type: "project", id: aliceId, permission: "read" }] },
      "Each policy's `type` must be one of: user, group, machineAccount.",
    ],
    [{ policies: [{ type: "user", id: "alice", permission: "read" }] }, "`alice` is not a GUID."],
    [
      { policies: [{ type: "user", id: aliceId, permission: "manage" }] },
      "`permission` must be one of: read, read-write.",
    ],
    [
      {
        policies: [
          { type: "user", id: aliceId, permission: "read" },
          { type: "user", id: aliceId, permission: "read-write" },
        ],
      },
      "`" + aliceId + "` is listed more than once.",
    ],
  ])("rejects %j", async (request, message) => {
    const response = await command.run(smOrg, "project", smTargetId, request);

    expect(response.success).toBe(false);
    expect(response.message).toBe(message);
    expect(fixture.accessPolicyService.getProjectPeopleAccessPolicies).not.toHaveBeenCalled();
  });

  it("rejects read-only people access to a machine account", async () => {
    const response = await command.run(smOrg, "machine-account", smTargetId, {
      policies: [{ type: "user", id: aliceId, permission: "read" }],
    });

    expect(response.message).toBe(
      "People can only be granted read-write access to a machine account.",
    );
  });

  it("rejects a request for another organization", async () => {
    const response = await command.run(smOrg, "project", smTargetId, {
      organizationId: smOtherOrgId,
      policies: [],
    });

    expect(response.message).toBe(
      "The request's `organizationId` property does not match the organization id.",
    );
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
  });
  it.each([
    ["group", groupId, "Engineering"],
    ["machineAccount", machineAccountId, "CI runner"],
  ])("explains when the id of a %s is sent with type user", async (actual, id) => {
    const response = await command.run(smOrg, "project", smTargetId, {
      policies: [{ type: "user", id, permission: "read" }],
    });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "`" +
        id +
        "` is a " +
        (actual === "group" ? "group" : "machine account") +
        ", not a user. Set the policy's `type` to `" +
        actual +
        "`.",
    );
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
  });

  it("rejects a grantee that does not exist", async () => {
    const id = "00000000-0000-0000-0000-000000000000";
    const response = await command.run(smOrg, "project", smTargetId, {
      policies: [{ type: "user", id, permission: "read" }],
    });

    expect(response.success).toBe(false);
    expect(response.message).toContain("No user `" + id + "` can be granted access");
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
  });
});
