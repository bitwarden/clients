import { Opaque } from "type-fest";

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
