import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { SmAccessPolicyResponse } from "../models/sm-access-policy.response";
import {
  bobId,
  createSmAccessFixture,
  groupId,
  groupPolicy,
  machineAccountId,
  machineAccountPolicy,
  projectId,
  smTargetId,
  userPolicy,
} from "../spec/sm-access-test-utils";
import { smOrgId } from "../spec/sm-test-utils";

import { AccessGetCommand } from "./access-get.command";

describe("AccessGetCommand", () => {
  let fixture: ReturnType<typeof createSmAccessFixture>;
  let command: AccessGetCommand;

  const run = async (target: string) => {
    const response = await command.run(smOrgId, target, smTargetId);
    expect(response.success).toBe(true);
    return ((response.data as ListResponse).data as SmAccessPolicyResponse[]).map((p) => [
      p.type,
      p.id,
      p.permission,
    ]);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fixture = createSmAccessFixture();
    command = new AccessGetCommand(fixture.store);
  });

  it("lists people and machine account access to a project", async () => {
    fixture.accessPolicyService.getProjectPeopleAccessPolicies.mockResolvedValue({
      userAccessPolicies: [userPolicy(bobId, "Bob", true)],
      groupAccessPolicies: [groupPolicy(groupId, "Engineering")],
    });
    fixture.accessPolicyService.getProjectServiceAccountsAccessPolicies.mockResolvedValue({
      serviceAccountAccessPolicies: [machineAccountPolicy(machineAccountId, "CI runner")],
    });

    expect(await run("project")).toEqual([
      ["user", bobId, "read-write"],
      ["group", groupId, "read"],
      ["machineAccount", machineAccountId, "read"],
    ]);
  });

  it("lists people access and granted projects for a machine account", async () => {
    fixture.accessPolicyService.getServiceAccountPeopleAccessPolicies.mockResolvedValue({
      userAccessPolicies: [userPolicy(bobId, "Bob", true)],
      groupAccessPolicies: [],
    });
    fixture.accessPolicyService.getServiceAccountGrantedPolicies.mockResolvedValue({
      grantedProjectPolicies: [
        {
          accessPolicy: {
            grantedProjectId: projectId,
            grantedProjectName: "Backend",
            read: true,
            write: false,
          },
          hasPermission: true,
        },
      ],
    });

    expect(await run("machine-account")).toEqual([
      ["user", bobId, "read-write"],
      ["project", projectId, "read"],
    ]);
    expect(fixture.serviceAccountService.getByServiceAccountId).toHaveBeenCalledWith(
      smTargetId,
      smOrgId,
    );
  });

  it("lists the access policies on a secret", async () => {
    fixture.accessPolicyService.getSecretAccessPolicies.mockResolvedValue({
      userAccessPolicies: [],
      groupAccessPolicies: [groupPolicy(groupId, "Engineering", true)],
      serviceAccountAccessPolicies: [],
    });

    expect(await run("secret")).toEqual([["group", groupId, "read-write"]]);
  });
});
