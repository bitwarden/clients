import { ImportType } from "../models";

import { Instructions, Loader } from "./data";

/** Mechanisms that load data into the importer. */
export type DataLoader = (typeof Loader)[keyof typeof Loader];

export type InstructionLink = (typeof Instructions)[keyof typeof Instructions];

/** Mechanisms that load data into the importer. */
export type ImporterMetadata = {
  /** Identifies the importer */
  type: ImportType;

  /** Identifies the instructions for the importer; this defaults to `unique`.  */
  instructions?: InstructionLink;

  /** Describes the strategies used to obtain imported data  */
  loaders: DataLoader[];
};
