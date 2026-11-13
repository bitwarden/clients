import { ProjectService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import {
  parseSmIds,
  SmOrganization,
  smBulkResponse,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class ProjectDeleteCommand {
  constructor(private projectService: ProjectService) {}

  async run(org: SmOrganization, projectIds: string[]): Promise<Response> {
    const parsed = parseSmIds(projectIds, "projectId");
    if (parsed.error) {
      return parsed.error;
    }

    try {
      const projects = await this.projectService.getProjects(org.organizationId);
      const toDelete = [];
      for (const id of parsed.ids) {
        const project = projects.find((p) => p.id === id);
        if (project == null) {
          return smNotFoundResponse("project `" + id + "`");
        }
        toDelete.push(project);
      }

      const results = await this.projectService.delete(toDelete);
      return smBulkResponse(results, "deleted");
    } catch (e) {
      return smErrorResponse(e, "project");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new ProjectDeleteCommand(serviceContainer.projectService);
  }
}
