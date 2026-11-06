import { ProjectService } from "@bitwarden/bit-sm/projects/project.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmProjectResponse } from "../models/sm-project.response";
import { parseSmId, validateSmOrganizationAccess, smErrorResponse } from "../sm-command.utils";

export class ProjectGetCommand {
  constructor(
    private projectService: ProjectService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, projectId: string): Promise<Response> {
    const org = await validateSmOrganizationAccess(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
    const project = parseSmId(projectId, "projectId");
    if (project.error) {
      return project.error;
    }

    try {
      const view = await this.projectService.getByProjectId(project.id, true);
      return Response.success(new SmProjectResponse(view));
    } catch (e) {
      return smErrorResponse(e, "project");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new ProjectGetCommand(
      serviceContainer.projectService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
