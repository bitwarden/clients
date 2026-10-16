import { ProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/project.view";
import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmProjectResponse } from "../models/sm-project.response";
import {
  checkSmRequestOrganization,
  parseSmRequest,
  readSmName,
  resolveSmOrganization,
  smErrorResponse,
} from "../sm-command.utils";

export class ProjectCreateCommand {
  constructor(
    private projectService: ProjectService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, requestJson: unknown): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
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
    return new ProjectCreateCommand(
      serviceContainer.projectService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
