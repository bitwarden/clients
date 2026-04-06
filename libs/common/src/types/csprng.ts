import { Opaque } from "type-fest";

// You would typically use these types when you want to create a type that
// represents an array or string value generated from a
// cryptographic secure pseudorandom number generator (CSPRNG)

export type CsprngArray = Opaque<Uint8Array, "CSPRNG">;

export type CsprngString = Opaque<string, "CSPRNG">;
