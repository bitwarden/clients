import { Observable } from "rxjs";

import { ImporterMetadata } from "../metadata";
import { ImportType } from "../models/import-options";

export abstract class ImportMetadataServiceAbstraction {
  abstract init(): Promise<void>;

  /** describes the features supported by a format */
  abstract metadata$: (type$: Observable<ImportType>) => Observable<ImporterMetadata>;
}
