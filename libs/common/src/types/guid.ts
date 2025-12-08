import { Opaque } from "type-fest";

import { isGuid } from "@bitwarden/guid";

export type Guid = Opaque<string, "Guid">;

// Convenience re-export of UserId from it's original location, any library that
// wants to be lower level than common should instead import it from user-core.
export { UserId } from "@bitwarden/user-core";
export type OrganizationId = Opaque<string, "OrganizationId">;
export type CollectionId = Opaque<string, "CollectionId">;
export type ProviderId = Opaque<string, "ProviderId">;
export type PolicyId = Opaque<string, "PolicyId">;
export type CipherId = Opaque<string, "CipherId">;
export type SendId = Opaque<string, "SendId">;
export type IndexedEntityId = Opaque<string, "IndexedEntityId">;
export type SecurityTaskId = Opaque<string, "SecurityTaskId">;
export type NotificationId = Opaque<string, "NotificationId">;
export type EmergencyAccessId = Opaque<string, "EmergencyAccessId">;
export type OrganizationIntegrationId = Opaque<string, "OrganizationIntegrationId">;
export type OrganizationIntegrationConfigurationId = Opaque<
  string,
  "OrganizationIntegrationConfigurationId"
>;
export type OrganizationReportId = Opaque<string, "OrganizationReportId">;

/**
 * A string representation of an empty guid.
 */
export const emptyGuid = "00000000-0000-0000-0000-000000000000";

/**
 * Determines if the provided value is a valid GUID string.
 *
 * @typeParam SomeGuid - The input type, defaults to `Guid`.
 * @typeParam Output - The output type, resolves to `SomeGuid` if it is an opaque string, otherwise to `Guid` if `SomeGuid` is a string, or `never`.
 * @param id - The value to check.
 * @returns `true` if `id` is a string and a valid GUID, otherwise `false`.
 */
export function isId<
  SomeGuid extends string = Guid,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Output = SomeGuid extends Opaque<string, infer T>
    ? SomeGuid
    : SomeGuid extends string
      ? Guid
      : never,
>(id: unknown): id is Output {
  return typeof id === "string" && isGuid(id);
}
