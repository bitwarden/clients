import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import {
  parseSmIds,
  resolveSmOrganization,
  smBulkResponse,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class ProjectDeleteCommand {
  constructor(
    private projectService: ProjectService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, projectIds: string[]): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
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
    return new ProjectDeleteCommand(
      serviceContainer.projectService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
