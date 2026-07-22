import { RecordV3 } from "./record-v3";

export type VaultItem = RecordV3 & {
  id: string;
  folders: string[];
};
