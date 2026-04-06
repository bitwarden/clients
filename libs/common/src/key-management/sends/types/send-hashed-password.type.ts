import { Opaque } from "type-fest";

export type SendHashedPassword = Opaque<Uint8Array<ArrayBuffer>, "SendHashedPassword">;
export type SendPasswordKeyMaterial = Opaque<Uint8Array<ArrayBuffer>, "SendPasswordKeyMaterial">;
