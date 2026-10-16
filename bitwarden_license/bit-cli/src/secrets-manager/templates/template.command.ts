import { Response } from "@bitwarden/cli/models/response";
import { TemplateResponse } from "@bitwarden/cli/models/response/template.response";

const SmTemplates = {
  "sm-project": () => ({
    organizationId: null as string | null,
    name: "Project name",
  }),
  "sm-secret": () => ({
    organizationId: null as string | null,
    key: "SECRET_NAME",
    value: "secret value",
    note: "",
    projectIds: ["00000000-0000-0000-0000-000000000000"],
  }),
  "sm-machine-account": () => ({
    organizationId: null as string | null,
    name: "Machine account name",
  }),
  "sm-access-policies": () => ({
    organizationId: null as string | null,
    policies: [{ type: "user", id: "00000000-0000-0000-0000-000000000000", permission: "read" }],
  }),
} as const;

export type SmTemplateObject = keyof typeof SmTemplates;
export const SmTemplateObjects = Object.keys(SmTemplates) as SmTemplateObject[];

export class TemplateCommand {
  async run(object: string): Promise<Response> {
    if (!SmTemplateObjects.includes(object as SmTemplateObject)) {
      return Response.badRequest(
        "Unknown template object `" +
          object +
          "`. Expected one of: " +
          SmTemplateObjects.join(", ") +
          ".",
      );
    }
    return Response.success(new TemplateResponse(SmTemplates[object as SmTemplateObject]()));
  }

  static create() {
    return new TemplateCommand();
  }
}
