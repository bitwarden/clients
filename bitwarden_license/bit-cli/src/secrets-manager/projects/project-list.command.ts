import { ProjectService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmProjectResponse } from "../models/sm-project.response";
import { validateSmOrganizationAccess, smErrorResponse } from "../sm-command.utils";

export class ProjectListCommand {
  constructor(
    private projectService: ProjectService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string): Promise<Response> {
    const org = await validateSmOrganizationAccess(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }

    try {
      const projects = await this.projectService.getProjects(org.organizationId);
      return Response.success(new ListResponse(projects.map((p) => new SmProjectResponse(p))));
    } catch (e) {
      return smErrorResponse(e, "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new ProjectListCommand(
      serviceContainer.projectService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
