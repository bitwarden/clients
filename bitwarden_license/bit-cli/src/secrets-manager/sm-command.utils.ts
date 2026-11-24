import { firstValueFrom, map } from "rxjs";

import { BulkOperationStatus } from "@bitwarden/bit-sm";
import { Response } from "@bitwarden/cli/models/response";
import { ListResponse } from "@bitwarden/cli/models/response/list.response";
import { CliUtils } from "@bitwarden/cli/utils";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { SmBulkStatusResponse } from "./models/sm-bulk-status.response";

/**
 * An organization the active user is a member of and can use Secrets Manager in. Commands receive
 * one instead of a raw `--organizationid` so they never repeat the access check.
 */
export type SmOrganization = {
  /** The normalized (lowercased) organization id. */
  organizationId: string;
  organization: Organization;
};

export type SmOrganizationResult =
  | { organizationId: string; organization: Organization; error?: undefined }
  | { organizationId?: undefined; organization?: undefined; error: Response };

/**
 * Normalizes an id argument and rejects anything that is not a GUID.
 * @returns the lowercased id, or an error response naming the offending argument.
 */
export function parseSmId(
  id: string,
  label: string,
): { id: string; error?: undefined } | { id?: undefined; error: Response } {
  if (Utils.isNullOrWhitespace(id)) {
    return { error: Response.badRequest("`" + label + "` is required.") };
  }
  const normalized = id.toLowerCase();
  if (!Utils.isGuid(normalized)) {
    return { error: Response.badRequest("`" + id + "` is not a GUID.") };
  }
  return { id: normalized };
}

/**
 * Normalizes a list of id arguments, rejecting an empty list, non-GUIDs, and duplicates.
 */
export function parseSmIds(
  ids: string[],
  label: string,
): { ids: string[]; error?: undefined } | { ids?: undefined; error: Response } {
  if (ids.length === 0) {
    return { error: Response.badRequest("At least one `" + label + "` is required.") };
  }
  const normalized: string[] = [];
  for (const id of ids) {
    const parsed = parseSmId(id, label);
    if (parsed.error) {
      return { error: parsed.error };
    }
    if (!normalized.includes(parsed.id)) {
      normalized.push(parsed.id);
    }
  }
  return { ids: normalized };
}

function isMissing(value: unknown): boolean {
  if (value == null) {
    return true;
  }
  if (typeof value !== "string") {
    return false;
  }
  return Utils.isNullOrWhitespace(value);
}

/**
 * Reads a JSON request from a base64 encoded argument, stdin, or an object passed by `bw serve`.
 */
export async function parseSmRequest<T extends object>(
  requestJson: unknown,
): Promise<{ request: Partial<T>; error?: undefined } | { request?: undefined; error: Response }> {
  const isServe = process.env.BW_SERVE === "true";
  const shouldReadStdin = !isServe && isMissing(requestJson);
  const input = shouldReadStdin ? await CliUtils.readStdin() : requestJson;
  if (isMissing(input)) {
    return { error: Response.badRequest("`requestJson` was not provided.") };
  }

  let request: unknown;
  if (typeof input !== "string") {
    request = input;
  } else {
    try {
      request = JSON.parse(Buffer.from(input, "base64").toString());
    } catch {
      return { error: Response.badRequest("Error parsing the encoded request data.") };
    }
  }
  if (request == null || typeof request !== "object" || Array.isArray(request)) {
    return { error: Response.badRequest("The request data must be a JSON object.") };
  }
  return { request: request as Partial<T> };
}

/**
 * Rejects a request body whose `organizationId` disagrees with the target organization.
 */
export function checkSmRequestOrganization(
  organizationId: string,
  requestOrganizationId: unknown,
): Response | undefined {
  if (isMissing(requestOrganizationId)) {
    return undefined;
  }
  if (
    typeof requestOrganizationId !== "string" ||
    requestOrganizationId.toLowerCase() !== organizationId
  ) {
    return Response.badRequest(
      "The request's `organizationId` property does not match the organization id.",
    );
  }
  return undefined;
}

/**
 * Properties of Secrets Manager responses that the server controls and an `edit` cannot change.
 * `organizationId` is not listed because `checkSmRequestOrganization` already rejects a
 * mismatching one.
 */
export const SM_READ_ONLY_PROPERTIES = [
  "object",
  "id",
  "creationDate",
  "revisionDate",
  "read",
  "write",
  "decryptionError",
  "accessToSecrets",
] as const;

/**
 * The properties each `edit` command changes. `organizationId` is also accepted (see
 * `checkSmRequestOrganization`), as are the `SM_READ_ONLY_PROPERTIES`.
 */
export const SM_EDITABLE_PROPERTIES = {
  project: ["name"],
  "machine account": ["name"],
  secret: ["key", "value", "note", "projectIds", "projects"],
} as const;

export type SmEditableEntity = keyof typeof SM_EDITABLE_PROPERTIES;

/**
 * Rejects a request body with properties the entity does not have, such as a misspelled one,
 * so an edit is not saved with part of the request silently ignored. `null` and
 * whitespace-only values count as absent, as in `checkSmReadOnlyProperties`.
 */
export function checkSmUnknownProperties(
  request: Record<string, unknown>,
  entity: SmEditableEntity,
): Response | undefined {
  const editable: readonly string[] = SM_EDITABLE_PROPERTIES[entity];
  const readOnly: readonly string[] = SM_READ_ONLY_PROPERTIES;
  const unknown = Object.keys(request).filter(
    (property) =>
      property !== "organizationId" &&
      !editable.includes(property) &&
      !readOnly.includes(property) &&
      !isMissing(request[property]),
  );
  if (unknown.length === 0) {
    return undefined;
  }
  const plural = unknown.length > 1;
  return Response.badRequest(
    unknown.map((property) => "`" + property + "`").join(", ") +
      (plural ? " are not " + entity + " properties." : " is not a " + entity + " property.") +
      " Remove " +
      (plural ? "these properties" : "this property") +
      " from the request. Properties that can be edited on a " +
      entity +
      ": " +
      editable.map((property) => "`" + property + "`").join(", ") +
      ".",
  );
}

function isSameSmValue(supplied: unknown, current: unknown): boolean {
  if (supplied === current) {
    return true;
  }
  return (
    typeof supplied === "string" &&
    typeof current === "string" &&
    Utils.isGuid(current) &&
    supplied.toLowerCase() === current.toLowerCase()
  );
}

/**
 * Rejects a request body that sets a server-controlled property (see `SM_READ_ONLY_PROPERTIES`).
 *
 * `existing` is the entity's current response, i.e. what `get` prints. A read-only property that
 * repeats the existing value unchanged is accepted, so the output of `get` can be piped into
 * `edit`. Any other value is rejected, including for properties the entity's response never
 * contains. A `false` value counts as supplied; `null` and whitespace-only values count as absent.
 */
export function checkSmReadOnlyProperties(
  request: Record<string, unknown>,
  entity: string,
  existing: object,
): Response | undefined {
  const current = existing as Record<string, unknown>;
  const present = SM_READ_ONLY_PROPERTIES.filter(
    (property) =>
      !isMissing(request[property]) && !isSameSmValue(request[property], current[property]),
  );
  if (present.length === 0) {
    return undefined;
  }
  return Response.badRequest(
    present.map((property) => "`" + property + "`").join(", ") +
      " cannot be edited on a " +
      entity +
      ". Remove " +
      (present.length > 1 ? "these properties" : "this property") +
      " from the request.",
  );
}

export function readSmString(
  request: Record<string, unknown>,
  property: string,
): { value?: string; error?: Response } {
  const value = request[property];
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "string") {
    return { error: Response.badRequest("`" + property + "` must be a string.") };
  }
  return { value };
}

export function readSmName(request: Record<string, unknown>): { name?: string; error?: Response } {
  const name = readSmString(request, "name");
  if (name.error) {
    return { error: name.error };
  }
  if (Utils.isNullOrWhitespace(name.value)) {
    return { error: Response.badRequest("`name` is required.") };
  }
  return { name: name.value };
}

/**
 * Maps the per-item results of a bulk operation to a CLI response. The response is an error
 * if any item failed, naming each failure.
 */
export function smBulkResponse(results: BulkOperationStatus[], action: string): Response {
  const failures = results.filter((r) => !Utils.isNullOrWhitespace(r.errorMessage));
  if (failures.length > 0) {
    const details = failures.map((f) => f.name + " (" + f.id + "): " + f.errorMessage);
    return Response.error(
      failures.length +
        " of " +
        results.length +
        " could not be " +
        action +
        ".\n" +
        details.join("\n"),
    );
  }
  return Response.success(new ListResponse(results.map((r) => new SmBulkStatusResponse(r))));
}

/**
 * Validates that the active user is a member of the organization and has access to Secrets Manager.
 * The server answers permission failures with a 404, so this check runs first to give a clear error.
 */
export async function validateSmOrganizationAccess(
  organizationService: OrganizationService,
  accountService: AccountService,
  organizationId: string,
): Promise<SmOrganizationResult> {
  const parsed = parseSmId(organizationId, "organizationid");
  if (parsed.error) {
    return { error: parsed.error };
  }

  const userId = await firstValueFrom(accountService.activeAccount$.pipe(map((a) => a?.id)));
  if (!userId) {
    return { error: Response.badRequest("No user found.") };
  }

  const organization = await firstValueFrom(
    organizationService
      .organizations$(userId)
      .pipe(map((organizations) => organizations.find((o) => o.id === parsed.id))),
  );
  if (organization == null) {
    return { error: Response.error("Organization not found.") };
  }
  if (!organization.canAccessSecretsManager) {
    return {
      error: Response.error("You do not have access to Secrets Manager for this organization."),
    };
  }

  return { organizationId: parsed.id, organization };
}

/**
 * Validates the `--organizationid` once and runs `action` with the validated organization.
 * Shared by the `bw sm` program and the `bw serve` routes so neither repeats the check.
 * @returns the validation error, or the response of `action`.
 */
export async function withSmOrganization(
  services: { organizationService: OrganizationService; accountService: AccountService },
  organizationId: string,
  action: (org: SmOrganization) => Promise<Response>,
): Promise<Response> {
  const result = await validateSmOrganizationAccess(
    services.organizationService,
    services.accountService,
    organizationId,
  );
  if (result.error) {
    return result.error;
  }
  return action({ organizationId: result.organizationId, organization: result.organization });
}

/**
 * The server returns 404 both for missing objects and for objects the user cannot access,
 * so the message covers both cases.
 */
export function smNotFoundResponse(objectName: string): Response {
  return Response.error("The " + objectName + " was not found, or you do not have access to it.");
}

/**
 * Fetch-by-id endpoints are not organization scoped, so a command that decrypts with the
 * `--organizationid` must reject items that belong to another organization.
 */
export function isInSmOrganization(
  item: { organizationId?: string },
  org: SmOrganization,
): boolean {
  return item.organizationId?.toLowerCase() === org.organizationId.toLowerCase();
}

export function smErrorResponse(error: unknown, objectName: string): Response {
  if (error instanceof ErrorResponse && error.statusCode === 404) {
    return smNotFoundResponse(objectName);
  }
  return Response.error(error);
}
