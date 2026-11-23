import { mock } from "jest-mock-extended";

import { ProjectService, ProjectView } from "@bitwarden/bit-sm";
import { TemplateResponse } from "@bitwarden/cli/models/response/template.response";

import { AccessSetCommand } from "../access/access-set.command";
import { ProjectCreateCommand } from "../projects/project-create.command";
import { checkSmRequestOrganization } from "../sm-command.utils";
import {
  bobId,
  createSmAccessFixture,
  groupId,
  machineAccountId,
  smTargetId,
  userPolicy,
} from "../spec/sm-access-test-utils";
import { encodeSmRequest, smOrg, smOrgId } from "../spec/sm-test-utils";

import { TemplateCommand } from "./template.command";

describe("TemplateCommand", () => {
  const command = new TemplateCommand();

  const template = async (object: string) =>
    ((await command.run(object)).data as TemplateResponse).template;

  it.each(["sm-project", "sm-secret", "sm-machine-account", "sm-access-policies"])(
    "returns a %s template accepted for any organization",
    async (object) => {
      const response = await command.run(object);

      expect(response.success).toBe(true);
      expect(response.data.object).toBe("template");
      expect(
        checkSmRequestOrganization(smOrgId, (await template(object)).organizationId),
      ).toBeUndefined();
    },
  );

  it("returns an sm-project template that project create accepts", async () => {
    const projectService = mock<ProjectService>();
    projectService.create.mockImplementation(async (_, view) =>
      Object.assign(new ProjectView(), view, { id: "22222222-2222-2222-2222-222222222222" }),
    );
    const createCommand = new ProjectCreateCommand(projectService);

    const response = await createCommand.run(
      smOrg,
      encodeSmRequest({ ...(await template("sm-project")), name: "Backend" }),
    );

    expect(response.success).toBe(true);
    expect(projectService.create).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({ organizationId: smOrgId, name: "Backend" }),
    );
  });

  it("returns an sm-access-policies template that keeps a grantee's existing permission", async () => {
    const fixture = createSmAccessFixture();
    fixture.accessPolicyService.getProjectPeopleAccessPolicies.mockResolvedValue({
      userAccessPolicies: [userPolicy(bobId, "Bob", true)],
      groupAccessPolicies: [],
    });
    const request = await template("sm-access-policies");
    request.policies[0].id = bobId;

    const response = await new AccessSetCommand(fixture.store).run(
      smOrg,
      "project",
      smTargetId,
      encodeSmRequest(request),
    );

    expect(response.success).toBe(true);
    expect(fixture.accessPolicyService.putProjectPeopleAccessPolicies).not.toHaveBeenCalled();
  });

  it.each([
    ["group", groupId],
    ["machineAccount", machineAccountId],
  ])(
    "returns an sm-access-policies template that access set accepts once `type` is set to %s",
    async (type, id) => {
      const fixture = createSmAccessFixture();
      const request = await template("sm-access-policies");
      request.policies[0].type = type;
      request.policies[0].id = id;

      const response = await new AccessSetCommand(fixture.store).run(
        smOrg,
        "project",
        smTargetId,
        encodeSmRequest(request),
      );

      expect(response.success).toBe(true);
    },
  );

  it("rejects an unknown object", async () => {
    const response = await command.run("item");

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "Unknown template object `item`. Expected one of: sm-project, sm-secret, sm-machine-account, sm-access-policies.",
    );
  });
});
