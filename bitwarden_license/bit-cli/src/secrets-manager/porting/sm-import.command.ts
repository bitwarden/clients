import { SecretsManagerImportError } from "@bitwarden/bit-common/secrets-manager/settings/models/error/sm-import-error";
import { SecretsManagerPortingApiService } from "@bitwarden/bit-common/secrets-manager/settings/services/sm-porting-api.service";
import { Response } from "@bitwarden/cli/models/response";
import { MessageResponse } from "@bitwarden/cli/models/response/message.response";
import { CliUtils } from "@bitwarden/cli/utils";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { ServiceContainer } from "../../service-container";
import { resolveSmOrganization } from "../sm-command.utils";

/**
 * The data to import: a path to a file, or for `bw serve` the parsed request body.
 */
export type SmImportInput =
  { file: string; data?: undefined } | { file?: undefined; data: unknown };

type SmImportCounts = { projects: number; secrets: number };

export class SmImportCommand {
  constructor(
    private portingApiService: SecretsManagerPortingApiService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
  ) {}

  async run(organizationId: string, input: SmImportInput): Promise<Response> {
    const org = await resolveSmOrganization(
      this.organizationService,
      this.accountService,
      organizationId,
    );
    if (org.error) {
      return org.error;
    }
    if (!org.organization.isAdmin) {
      return Response.error("Only organization owners and admins can import Secrets Manager data.");
    }

    let data: unknown = input.data;
    if (input.file != null) {
      let contents: string;
      try {
        contents = await CliUtils.readFile(input.file);
      } catch (e) {
        return Response.badRequest("Could not read file: " + String(e));
      }
      if (Utils.isNullOrWhitespace(contents)) {
        return Response.badRequest("Import file was empty.");
      }
      try {
        data = JSON.parse(contents);
      } catch {
        return Response.badRequest("The import file is not valid JSON.");
      }
    }

    const validated = validateImportData(data);
    if (validated.error) {
      return validated.error;
    }

    try {
      await this.portingApiService.import(org.organizationId, JSON.stringify(data));
    } catch (e) {
      return importErrorResponse(e);
    }

    return Response.success(
      new MessageResponse(
        "Imported " +
          validated.counts.projects +
          " project(s) and " +
          validated.counts.secrets +
          " secret(s).",
        null,
      ),
    );
  }

  static create(serviceContainer: ServiceContainer) {
    return new SmImportCommand(
      serviceContainer.secretsManagerPortingApiService,
      serviceContainer.organizationService,
      serviceContainer.accountService,
    );
  }
}

/**
 * Checks the shape of a Secrets Manager export before it is encrypted. The porting service
 * cannot report which item is malformed, so this names the first offending property.
 */
function validateImportData(
  data: unknown,
): { counts: SmImportCounts; error?: undefined } | { counts?: undefined; error: Response } {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { error: Response.badRequest("The import data must be a JSON object.") };
  }
  const { projects, secrets } = data as Record<string, unknown>;
  if (!Array.isArray(projects)) {
    return { error: Response.badRequest("`projects` must be an array.") };
  }
  if (!Array.isArray(secrets)) {
    return { error: Response.badRequest("`secrets` must be an array.") };
  }

  for (let i = 0; i < projects.length; i++) {
    const error = checkStrings(projects[i], "projects[" + i + "]", ["id", "name"]);
    if (error) {
      return { error };
    }
  }

  for (let i = 0; i < secrets.length; i++) {
    const label = "secrets[" + i + "]";
    const error = checkStrings(secrets[i], label, ["id", "key", "value", "note"]);
    if (error) {
      return { error };
    }
    const projectIds = (secrets[i] as Record<string, unknown>).projectIds;
    if (!Array.isArray(projectIds) || projectIds.some((id) => typeof id !== "string")) {
      return {
        error: Response.badRequest("`" + label + ".projectIds` must be an array of strings."),
      };
    }
  }

  return { counts: { projects: projects.length, secrets: secrets.length } };
}

function checkStrings(item: unknown, label: string, properties: string[]): Response | undefined {
  if (item == null || typeof item !== "object" || Array.isArray(item)) {
    return Response.badRequest("`" + label + "` must be an object.");
  }
  for (const property of properties) {
    if (typeof (item as Record<string, unknown>)[property] !== "string") {
      return Response.badRequest("`" + label + "." + property + "` must be a string.");
    }
  }
  return undefined;
}

function importErrorResponse(error: unknown): Response {
  if (error instanceof SecretsManagerImportError && error.lines?.length > 0) {
    const details = error.lines.map(
      (line) => "  " + line.type + " " + line.id + " (" + line.key + "): " + line.errorMessage,
    );
    return Response.badRequest("The import failed:\n" + details.join("\n"));
  }
  if (error instanceof Error && !Utils.isNullOrWhitespace(error.message)) {
    return Response.badRequest(error.message);
  }
  return Response.error(error);
}
