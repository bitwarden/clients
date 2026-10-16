import { mock } from "jest-mock-extended";

import { ProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/project.view";
import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { TemplateResponse } from "@bitwarden/cli/models/response/template.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ProjectCreateCommand } from "../projects/project-create.command";
import { checkSmRequestOrganization } from "../sm-command.utils";
import { encodeSmRequest, mockSmOrganization, smOrgId } from "../spec/sm-test-utils";

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
    const organizationService = mock<OrganizationService>();
    const accountService = mock<AccountService>();
    mockSmOrganization(accountService, organizationService);
    projectService.create.mockImplementation(async (_, view) =>
      Object.assign(new ProjectView(), view, { id: "22222222-2222-2222-2222-222222222222" }),
    );
    const createCommand = new ProjectCreateCommand(
      projectService,
      organizationService,
      accountService,
    );

    const response = await createCommand.run(
      smOrgId,
      encodeSmRequest({ ...(await template("sm-project")), name: "Backend" }),
    );

    expect(response.success).toBe(true);
    expect(projectService.create).toHaveBeenCalledWith(
      smOrgId,
      expect.objectContaining({ organizationId: smOrgId, name: "Backend" }),
    );
  });

  it("rejects an unknown object", async () => {
    const response = await command.run("item");

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "Unknown template object `item`. Expected one of: sm-project, sm-secret, sm-machine-account, sm-access-policies.",
    );
  });
});
