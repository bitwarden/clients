import { ProjectService, ProjectView } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import { SmProjectResponse } from "../models/sm-project.response";
import {
  checkSmRequestOrganization,
  parseSmRequest,
  readSmName,
  SmOrganization,
  smErrorResponse,
} from "../sm-command.utils";

export class ProjectCreateCommand {
  constructor(private projectService: ProjectService) {}

  async run(org: SmOrganization, requestJson: unknown): Promise<Response> {
    const parsed = await parseSmRequest<Record<string, unknown>>(requestJson);
    if (parsed.error) {
      return parsed.error;
    }
    const orgMismatch = checkSmRequestOrganization(
      org.organizationId,
      parsed.request.organizationId,
    );
    if (orgMismatch) {
      return orgMismatch;
    }
    const name = readSmName(parsed.request);
    if (name.error) {
      return name.error;
    }

    const view = new ProjectView();
    view.organizationId = org.organizationId;
    view.name = name.name!;

    try {
      const project = await this.projectService.create(org.organizationId, view);
      return Response.success(new SmProjectResponse(project));
    } catch (e) {
      return smErrorResponse(e, "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new ProjectCreateCommand(serviceContainer.projectService);
  }
}
