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
import { encodeSmRequest, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

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
      smOrgId,
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

  it("accepts an object body from bw serve", async () => {
    const response = await command.run(smOrgId, "project", smTargetId, {
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
    const response = await command.run(smOrgId, "project", smTargetId, request);

    expect(response.success).toBe(false);
    expect(response.message).toBe(message);
    expect(fixture.accessPolicyService.getProjectPeopleAccessPolicies).not.toHaveBeenCalled();
  });

  it("rejects read-only people access to a machine account", async () => {
    const response = await command.run(smOrgId, "machine-account", smTargetId, {
      policies: [{ type: "user", id: aliceId, permission: "read" }],
    });

    expect(response.message).toBe(
      "People can only be granted read-write access to a machine account.",
    );
  });

  it("rejects a request for another organization", async () => {
    const response = await command.run(smOrgId, "project", smTargetId, {
      organizationId: smOtherOrgId,
      policies: [],
    });

    expect(response.message).toBe(
      "The request's `organizationId` property does not match the organization id.",
    );
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
  });
});
