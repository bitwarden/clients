import { ProjectService, SecretProjectView, SecretService, SecretView } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";

import { ServiceContainer } from "../../service-container";
import { SmSecretResponse } from "../models/sm-secret.response";
import {
  checkSmRequestOrganization,
  parseSmRequest,
  SmOrganization,
  smErrorResponse,
} from "../sm-command.utils";

import { fillSmSecretProjectNames } from "./sm-secret-project-names";
import { readSmSecretRequest } from "./sm-secret-request";

export class SecretCreateCommand {
  constructor(
    private secretService: SecretService,
    private projectService: ProjectService,
  ) {}

  async run(org: SmOrganization, requestJson: unknown): Promise<Response> {
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
    const secret = readSmSecretRequest(parsed.request);
    if (secret.error) {
      return secret.error;
    }
    if (secret.fields.key == null) {
      return Response.badRequest("`key` is required.");
    }

    const view = new SecretView();
    view.organizationId = org.organizationId;
    view.name = secret.fields.key;
    view.value = secret.fields.value ?? "";
    view.note = secret.fields.note ?? "";
    view.projects = (secret.fields.projectIds ?? []).map((id) =>
      Object.assign(new SecretProjectView(), { id }),
    );

    try {
      const created = await this.secretService.create(org.organizationId, view, undefined);
      await fillSmSecretProjectNames(this.projectService, org, created, view.projects);
      return Response.success(new SmSecretResponse(created));
    } catch (e) {
      return smErrorResponse(e, view.projects.length > 0 ? "project" : "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new SecretCreateCommand(serviceContainer.secretService, serviceContainer.projectService);
  }
}
