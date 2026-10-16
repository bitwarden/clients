import { ProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/project.view";
import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmProjectResponse } from "../models/sm-project.response";
import {
  checkSmRequestOrganization,
  parseSmId,
  parseSmRequest,
  readSmName,
  resolveSmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export class ProjectEditCommand {
  constructor(
    private projectService: ProjectService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, projectId: string, requestJson: unknown): Promise<Response> {
    const org = await resolveSmOrganization(
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

    try {
      const existing = await this.projectService.getByProjectId(project.id, true);
      if (existing.organizationId !== org.organizationId) {
        return smNotFoundResponse("project");
      }
      if (!existing.write) {
        return Response.noEditPermission();
      }

      const view = new ProjectView();
      view.id = project.id;
      view.organizationId = org.organizationId;
      view.name = name.name!;

      const updated = await this.projectService.update(org.organizationId, view);
      return Response.success(new SmProjectResponse(updated));
    } catch (e) {
      return smErrorResponse(e, "project");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new ProjectEditCommand(
      serviceContainer.projectService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
