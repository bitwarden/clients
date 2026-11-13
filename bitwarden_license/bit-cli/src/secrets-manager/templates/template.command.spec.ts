import { mock } from "jest-mock-extended";

import { ProjectService, ProjectView } from "@bitwarden/bit-sm";
import { TemplateResponse } from "@bitwarden/cli/models/response/template.response";

import { ProjectCreateCommand } from "../projects/project-create.command";
import { checkSmRequestOrganization } from "../sm-command.utils";
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

  it("rejects an unknown object", async () => {
    const response = await command.run("item");

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "Unknown template object `item`. Expected one of: sm-project, sm-secret, sm-machine-account, sm-access-policies.",
    );
  });
});
