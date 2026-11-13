import { ProjectService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmProjectResponse } from "../models/sm-project.response";
import { SmOrganization, smErrorResponse } from "../sm-command.utils";

export class ProjectListCommand {
  constructor(private projectService: ProjectService) {}

  async run(org: SmOrganization): Promise<Response> {
    try {
      const projects = await this.projectService.getProjects(org.organizationId);
      return Response.success(new ListResponse(projects.map((p) => new SmProjectResponse(p))));
    } catch (e) {
      return smErrorResponse(e, "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new ProjectListCommand(serviceContainer.projectService);
  }
}
