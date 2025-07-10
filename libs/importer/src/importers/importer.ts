import { ImportResult } from "../models/import-result";

export interface Importer {
  organizationId: string;
  parse(data: string): Promise<ImportResult>;
}
