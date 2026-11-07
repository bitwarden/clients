import { SecretService } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";

import { ServiceContainer } from "../../service-container";
import { SmSecretResponse } from "../models/sm-secret.response";
import { parseSmId, SmOrganization, smErrorResponse } from "../sm-command.utils";

export class SecretListCommand {
  constructor(private secretService: SecretService) {}

  async run(org: SmOrganization, projectId?: string): Promise<Response> {
    let parsedProjectId: string | undefined;
    if (projectId != null) {
      const project = parseSmId(projectId, "projectid");
      if (project.error) {
        return project.error;
      }
      parsedProjectId = project.id;
    }

    try {
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
    return new SecretListCommand(serviceContainer.secretService);
  }
}
