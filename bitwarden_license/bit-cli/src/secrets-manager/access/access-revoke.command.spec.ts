import {
  aliceId,
  bobId,
  createSmAccessFixture,
  groupId,
  groupPolicy,
  machineAccountId,
  machineAccountPolicy,
  smTargetId,
  userPolicy,
} from "../spec/sm-access-test-utils";
import { smOrgId } from "../spec/sm-test-utils";

import { AccessRevokeCommand } from "./access-revoke.command";

describe("AccessRevokeCommand", () => {
  let fixture: ReturnType<typeof createSmAccessFixture>;
  let command: AccessRevokeCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    fixture = createSmAccessFixture();
    command = new AccessRevokeCommand(fixture.store);
    fixture.accessPolicyService.getProjectPeopleAccessPolicies.mockResolvedValue({
      userAccessPolicies: [userPolicy(aliceId, "Alice"), userPolicy(bobId, "Bob", true)],
      groupAccessPolicies: [groupPolicy(groupId, "Engineering")],
    });
    fixture.accessPolicyService.getProjectServiceAccountsAccessPolicies.mockResolvedValue({
      serviceAccountAccessPolicies: [machineAccountPolicy(machineAccountId, "CI runner")],
    });
  });

  it("removes only the target user", async () => {
    const response = await command.run(smOrgId, "project", smTargetId, "alice@example.com");

    expect(response.success).toBe(true);
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).toHaveBeenCalledWith(
      smTargetId,
      {
        userAccessPolicies: [
          expect.objectContaining({ organizationUserId: bobId, read: true, write: true }),
        ],
        groupAccessPolicies: [expect.objectContaining({ groupId: groupId })],
      },
    );
    expect(
      fixture.accessPolicyService.putProjectServiceAccountsAccessPolicies,
    ).not.toHaveBeenCalled();
  });

  it("removes a machine account by id without touching people access", async () => {
    const response = await command.run(smOrgId, "project", smTargetId, machineAccountId);

    expect(response.success).toBe(true);
    expect(
      fixture.accessPolicyService.putProjectServiceAccountsAccessPolicies,
    ).toHaveBeenCalledWith(smOrgId, smTargetId, { serviceAccountAccessPolicies: [] });
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
  });

  it("removes a granted project from a machine account", async () => {
    const otherProjectId = "4d4d4d4d-0000-0000-0000-0000000000ff";
    fixture.accessPolicyService.getServiceAccountGrantedPolicies.mockResolvedValue({
      grantedProjectPolicies: [
        {
          accessPolicy: {
            grantedProjectId: "4d4d4d4d-0000-0000-0000-000000000005",
            grantedProjectName: "Backend",
            read: true,
            write: false,
          },
          hasPermission: true,
        },
        {
          accessPolicy: {
            grantedProjectId: otherProjectId,
            grantedProjectName: "Frontend",
            read: true,
            write: true,
          },
          hasPermission: true,
        },
      ],
    });

    const response = await command.run(smOrgId, "machine-account", smTargetId, "Backend");

    expect(response.success).toBe(true);
    expect(fixture.accessPolicyService.putServiceAccountGrantedPolicies).toHaveBeenCalledWith(
      smOrgId,
      smTargetId,
      {
        grantedProjectPolicies: [
          expect.objectContaining({
            accessPolicy: expect.objectContaining({
              grantedProjectId: otherProjectId,
              read: true,
              write: true,
            }),
          }),
        ],
      },
    );
  });

  it("errors when the grantee has no access", async () => {
    fixture.accessPolicyService.getProjectPeopleAccessPolicies.mockResolvedValue({
      userAccessPolicies: [userPolicy(bobId, "Bob")],
      groupAccessPolicies: [],
    });

    const response = await command.run(smOrgId, "project", smTargetId, "alice@example.com");

    expect(response.success).toBe(false);
    expect(response.message).toBe("`alice@example.com` does not have access.");
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
  });

  it("errors when the grantee cannot be found", async () => {
    const response = await command.run(smOrgId, "project", smTargetId, "nobody@example.com");

    expect(response.success).toBe(false);
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
  });
});
