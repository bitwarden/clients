import { ImportType } from "../models";

import { Loader } from "./data";

/** Mechanisms that load data into the importer. */
export type DataLoader = (typeof Loader)[keyof typeof Loader];

/** Mechanisms that load data into the importer. */
export type ImporterMetadata = {
  /** Identifies the importer */
  type: ImportType;

  /** Describes the strategies used to obtain imported data  */
  loaders: DataLoader[];

  /** i18n key for the importer's step-by-step help-text instructions shown in the import UI */
  instructionKey?: string;

  /** Static help URL for the importer's Help Center article, if any */
  instructionLink?: string;

  /** Clean vendor name interpolated into the generic "See detailed $NAME$ instructions
   *  in our Help Center" sentence shown when `instructionLink` is set */
  sourceName?: string;
};
