import { Opaque } from "type-fest";

export type StorageKey = Opaque<string, "StorageKey">;

export type DerivedStateDependencies = Record<string, unknown>;
