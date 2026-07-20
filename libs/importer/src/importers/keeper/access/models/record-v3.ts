import { VaultField } from "./vault-field";

// TODO: Add RecordV2!

export type RecordV3 = {
  type: string;
  title: string;
  notes: string;
  fields: VaultField[];
  custom: VaultField[];
};
