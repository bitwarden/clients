import { ProjectService } from "@bitwarden/bit-common/secrets-manager/projects/project.service";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { CountService } from "@bitwarden/bit-common/secrets-manager/shared/counts/count.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { resolveSmMachineAccountId } from "../access-tokens/sm-access-token.utils";
import { SmCountsResponse } from "../models/sm-counts.response";
import {
  parseSmId,
  resolveSmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

export type CountsOptions = {
  projectId?: string;
  machineAccountId?: string;
};

export class CountsCommand {
  constructor(
    private countService: CountService,
    private projectService: ProjectService,
    private serviceAccountService: ServiceAccountService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, options: CountsOptions = {}): Promise<Response> {
    if (options.projectId != null && options.machineAccountId != null) {
      return Response.badRequest("Specify either `projectid` or `machineaccountid`, not both.");
    }

    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }

    if (options.projectId != null) {
      const project = parseSmId(options.projectId, "projectid");
      if (project.error) {
        return project.error;
      }
      try {
        const view = await this.projectService.getByProjectId(project.id, true);
        if (view.organizationId !== org.organizationId) {
          return smNotFoundResponse("project");
        }
        const counts = await this.countService.getProjectCounts(project.id);
        return Response.success(
          new SmCountsResponse("project", project.id, {
            secrets: counts.secrets,
            people: counts.people,
            machineAccounts: counts.serviceAccounts,
          }),
        );
      } catch (e) {
        return smErrorResponse(e, "project");
      }
    }

    if (options.machineAccountId != null) {
      const machineAccount = await resolveSmMachineAccountId(
        this.serviceAccountService,
        org.organizationId,
        options.machineAccountId,
      );
      if (machineAccount.error) {
        return machineAccount.error;
      }
      try {
        const counts = await this.countService.getServiceAccountCounts(
          machineAccount.machineAccountId,
        );
        return Response.success(
          new SmCountsResponse("machine-account", machineAccount.machineAccountId, {
            projects: counts.projects,
            people: counts.people,
            accessTokens: counts.accessTokens,
          }),
        );
      } catch (e) {
        return smErrorResponse(e, "machine account");
      }
    }

    try {
      const counts = await this.countService.getOrganizationCounts(org.organizationId);
      return Response.success(
        new SmCountsResponse("organization", org.organizationId, {
          projects: counts.projects,
          secrets: counts.secrets,
          machineAccounts: counts.serviceAccounts,
        }),
      );
    } catch (e) {
      return smErrorResponse(e, "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new CountsCommand(
      serviceContainer.countService,
      serviceContainer.projectService,
      serviceContainer.serviceAccountService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
