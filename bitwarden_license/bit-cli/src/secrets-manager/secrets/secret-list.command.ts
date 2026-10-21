import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmSecretResponse } from "../models/sm-secret.response";
import {
  parseSmId,
  resolveSmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class SecretListCommand {
  constructor(
    private secretService: SecretService,
    private projectService: ProjectService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, projectId?: string): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }

    let parsedProjectId: string | undefined;
    if (projectId != null) {
      const project = parseSmId(projectId, "projectid");
      if (project.error) {
        return project.error;
      }
      parsedProjectId = project.id;
    }

    try {
      if (parsedProjectId != null) {
        const project = await this.projectService.getByProjectId(parsedProjectId, true);
        if (project.organizationId !== org.organizationId) {
          return smNotFoundResponse("project");
        }
      }
      const secrets =
        parsedProjectId != null
          ? await this.secretService.getSecretsByProject(org.organizationId, parsedProjectId)
          : await this.secretService.getSecrets(org.organizationId);
      return Response.success(new ListResponse(secrets.map((s) => new SmSecretResponse(s))));
    } catch (e) {
      return smErrorResponse(e, parsedProjectId != null ? "project" : "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new SecretListCommand(
      serviceContainer.secretService,
      serviceContainer.projectService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
