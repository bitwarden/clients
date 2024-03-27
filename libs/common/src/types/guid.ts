import { Opaque } from "type-fest";

export type Guid = Opaque<string, "Guid">;

export type UserId = Opaque<string, "UserId">;
export type OrganizationId = Opaque<string, "OrganizationId">;
export type CollectionId = Opaque<string, "CollectionId">;
export type ProviderId = Opaque<string, "ProviderId">;
export type PolicyId = Opaque<string, "PolicyId">;
export type CipherId = Opaque<string, "CipherId">;
