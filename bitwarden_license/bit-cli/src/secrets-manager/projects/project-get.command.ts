import { ProjectService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import { SmProjectResponse } from "../models/sm-project.response";
import {
  isInSmOrganization,
  parseSmId,
  SmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class ProjectGetCommand {
  constructor(private projectService: ProjectService) {}

  async run(org: SmOrganization, projectId: string): Promise<Response> {
    const project = parseSmId(projectId, "projectId");
    if (project.error) {
      return project.error;
    }

    try {
      const view = await this.projectService.getByProjectId(project.id, true);
      if (!isInSmOrganization(view, org)) {
        return smNotFoundResponse("project");
      }
      return Response.success(new SmProjectResponse(view));
    } catch (e) {
      return smErrorResponse(e, "project");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new ProjectGetCommand(serviceContainer.projectService);
  }
}
