import { Response } from "@bitwarden/cli/models/response";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { parseSmId, readSmString } from "../sm-command.utils";

export type SmSecretRequestFields = {
  key?: string;
  value?: string;
  note?: string;
  projectIds?: string[];
};

/**
 * Reads and validates the secret properties present in a request body. Properties that are
 * absent are left undefined so edits can keep the existing values.
 */
export function readSmSecretRequest(
  request: Record<string, unknown>,
): { fields: SmSecretRequestFields; error?: undefined } | { fields?: undefined; error: Response } {
  const fields: SmSecretRequestFields = {};
  for (const property of ["key", "value", "note"] as const) {
    const read = readSmString(request, property);
    if (read.error) {
      return { error: read.error };
    }
    fields[property] = read.value;
  }
  if (fields.key !== undefined && Utils.isNullOrWhitespace(fields.key)) {
    return { error: Response.badRequest("`key` cannot be empty.") };
  }

  const projectIds = request.projectIds;
  if (projectIds !== undefined && projectIds !== null) {
    if (!Array.isArray(projectIds)) {
      return { error: Response.badRequest("`projectIds` must be an array of project ids.") };
    }
    if (projectIds.length > 1) {
      return { error: Response.badRequest("A secret can only be assigned to one project.") };
    }
    fields.projectIds = [];
    for (const projectId of projectIds) {
      if (typeof projectId !== "string") {
        return { error: Response.badRequest("`projectIds` must be an array of project ids.") };
      }
      const parsed = parseSmId(projectId, "projectIds");
      if (parsed.error) {
        return { error: parsed.error };
      }
      fields.projectIds.push(parsed.id);
    }
  }

  return { fields };
}
