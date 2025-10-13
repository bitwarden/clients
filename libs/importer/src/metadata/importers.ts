import { ImportType } from "../models";

import { Instructions, Loader } from "./data";
import { ImporterMetadata } from "./types";

export type ImportersMetadata = Partial<Record<ImportType, ImporterMetadata>>;

export const importersMetadata: ImportersMetadata = {
  bitwardenjson: {
    type: "bitwardenjson",
    loaders: [Loader.file],
    instructions: Instructions.unique,
  },
};
