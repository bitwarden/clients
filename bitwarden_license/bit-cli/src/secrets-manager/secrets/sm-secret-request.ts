import { Response } from "@bitwarden/cli/models/response";

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
  if (fields.key != null && fields.key.trim() === "") {
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
      const parsed = parseSmId(typeof projectId === "string" ? projectId : undefined, "projectIds");
      if (parsed.error) {
        return { error: parsed.error };
      }
      fields.projectIds.push(parsed.id);
    }
  }

  return { fields };
}
