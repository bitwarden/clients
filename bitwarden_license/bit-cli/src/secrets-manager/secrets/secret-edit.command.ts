import { SecretProjectView } from "@bitwarden/bit-common/secrets-manager/models/view/secret-project.view";
import { SecretView } from "@bitwarden/bit-common/secrets-manager/models/view/secret.view";
import { SecretService } from "@bitwarden/bit-common/secrets-manager/secrets/secret.service";
import { Response } from "@bitwarden/cli/models/response";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
// eslint-disable-next-line no-restricted-imports
import { DECRYPT_ERROR } from "@bitwarden/legacy-crypto";

import { ServiceContainer } from "../../service-container";
import { SmSecretResponse } from "../models/sm-secret.response";
import {
  checkSmRequestOrganization,
  parseSmId,
  parseSmRequest,
  resolveSmOrganization,
  smErrorResponse,
  smNotFoundResponse,
} from "../sm-command.utils";

import { readSmSecretRequest } from "./sm-secret-request";

/**
 * Edits a secret. Properties missing from the request keep their current values, and the
 * secret's access policies are left unchanged.
 */
export class SecretEditCommand {
  constructor(
    private secretService: SecretService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, secretId: string, requestJson: unknown): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
    const secret = parseSmId(secretId, "secretId");
    if (secret.error) {
      return secret.error;
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
    const fields = readSmSecretRequest(parsed.request);
    if (fields.error) {
      return fields.error;
    }

    try {
      const existing = await this.secretService.getBySecretId(secret.id);
      if (existing.organizationId !== org.organizationId) {
        return smNotFoundResponse("secret");
      }
      if (!existing.write) {
        return Response.noEditPermission();
      }
      const undecryptable = (["key", "value", "note"] as const).filter(
        (property) =>
          fields.fields[property] == null &&
          existing[property === "key" ? "name" : property] === DECRYPT_ERROR,
      );
      if (undecryptable.length > 0) {
        return Response.error(
          "The secret's " +
            undecryptable.join(", ") +
            " could not be decrypted. Provide new values for them in the request.",
        );
      }

      const view = new SecretView();
      view.id = secret.id;
      view.organizationId = org.organizationId;
      view.name = fields.fields.key ?? existing.name;
      view.value = fields.fields.value ?? existing.value;
      view.note = fields.fields.note ?? existing.note;
      view.projects =
        fields.fields.projectIds != null
          ? fields.fields.projectIds.map((id) => Object.assign(new SecretProjectView(), { id }))
          : (existing.projects ?? []);

      const updated = await this.secretService.update(
        org.organizationId,
        view,
        null,
        view.value !== existing.value,
      );
      return Response.success(new SmSecretResponse(updated));
    } catch (e) {
      return smErrorResponse(e, "secret");
    }
  }

  static create(serviceContainer: ServiceContainer) {
    return new SecretEditCommand(
      serviceContainer.secretService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}
