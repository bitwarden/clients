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

  const projects = readSmSecretProjectIds(request);
  if (projects.error) {
    return { error: projects.error };
  }
  fields.projectIds = projects.projectIds;

  return { fields };
}

/**
 * Reads the project assignment. The documented `projectIds` array of ids is accepted, as is the
 * `projects` array of `{ id, name }` objects that secret responses use, so a response body can
 * be sent back as a request. `name` is ignored. Returns no ids when neither property is present.
 */
function readSmSecretProjectIds(
  request: Record<string, unknown>,
): { projectIds?: string[]; error?: undefined } | { projectIds?: undefined; error: Response } {
  const hasIds = request.projectIds !== undefined && request.projectIds !== null;
  const hasProjects = request.projects !== undefined && request.projects !== null;
  if (hasIds && hasProjects) {
    return { error: Response.badRequest("Provide either `projectIds` or `projects`, not both.") };
  }
  if (!hasIds && !hasProjects) {
    return {};
  }

  const property = hasIds ? "projectIds" : "projects";
  const list = request[property];
  const invalid = Response.badRequest(
    hasIds
      ? "`projectIds` must be an array of project ids."
      : "`projects` must be an array of objects with a project `id`.",
  );
  if (!Array.isArray(list)) {
    return { error: invalid };
  }
  if (list.length > 1) {
    return { error: Response.badRequest("A secret can only be assigned to one project.") };
  }
  const projectIds: string[] = [];
  for (const entry of list) {
    const id = hasIds ? entry : (entry as { id?: unknown } | null)?.id;
    if (typeof id !== "string") {
      return { error: invalid };
    }
    const parsed = parseSmId(id, hasIds ? "projectIds" : "projects[].id");
    if (parsed.error) {
      return { error: parsed.error };
    }
    projectIds.push(parsed.id);
  }
  return { projectIds };
}
