import { Observable } from "rxjs";

import { DataLoader } from "../metadata";
import { ImportType } from "../models/import-options";

/** The loaders available for a format on the current client/machine. Everything else about an
 *  importer (name, instructions, accepted file types, ...) is static — read it directly from
 *  `importOptions` in `models/import-options.ts` instead of through this service. */
export type ImporterCapabilities = {
  type: ImportType;
  loaders: DataLoader[];
};

export abstract class ImportMetadataServiceAbstraction {
  abstract init(): Promise<void>;

  /** describes the loaders available for a format on this client/machine */
  abstract metadata$: (type$: Observable<ImportType>) => Observable<ImporterCapabilities>;
}
