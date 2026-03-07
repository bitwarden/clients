export type Decryptor = (data: Uint8Array, key: Uint8Array) => Promise<Uint8Array>;
