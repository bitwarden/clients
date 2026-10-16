import { SecretProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-project.view";
import { SecretView } from "@bitwarden/bit-common/secrets-manager/models/view/secret.view";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { ServiceContainer } from "../../service-container";
import { SmSecretResponse } from "../models/sm-secret.response";
import {
  checkSmRequestOrganization,
  parseSmRequest,
  resolveSmOrganization,
  smErrorResponse,
} from "../sm-command.utils";

import { readSmSecretRequest } from "./sm-secret-request";

export class SecretCreateCommand {
  constructor(
    private secretService: SecretService,
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
      const created = await this.secretService.create(org.organizationId, view, null);
      return Response.success(new SmSecretResponse(created));
    } catch (e) {
      return smErrorResponse(e, view.projects.length > 0 ? "project" : "organization");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new SecretCreateCommand(
      serviceContainer.secretService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
