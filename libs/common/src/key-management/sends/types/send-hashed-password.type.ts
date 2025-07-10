import { Opaque } from "type-fest";

/**
 * Represents an opaque hashed send password as a base64 encoded string.
 */
export type SendHashedPassword = Opaque<string, "SendHashedPassword">;
