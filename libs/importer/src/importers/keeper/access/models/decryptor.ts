import { KeeperKey } from "./crypto-types";

export type Decryptor = (data: Uint8Array, key: KeeperKey) => Promise<Uint8Array>;
