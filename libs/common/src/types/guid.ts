import { Opaque } from "type-fest";

export const EMPTY_GUID = "00000000-0000-0000-0000-000000000000" as Guid;
export type Guid = Opaque<string, "Guid">;
