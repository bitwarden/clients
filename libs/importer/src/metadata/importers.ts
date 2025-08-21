import { deepFreeze } from "@bitwarden/common/tools/util";

import { ImportType } from "../models";

import { Loader, Instructions } from "./data";
import { ImporterMetadata } from "./types";

const importers = [
  { id: "chromecsv", loaders: [Loader.file], instructions: Instructions.chromium },
  { id: "operacsv", loaders: [Loader.file, Loader.chromium], instructions: Instructions.chromium },
  {
    id: "vivaldicsv",
    loaders: [Loader.file, Loader.chromium],
    instructions: Instructions.chromium,
  },
  { id: "bravecsv", loaders: [Loader.file, Loader.chromium], instructions: Instructions.chromium },
  { id: "edgecsv", loaders: [Loader.file, Loader.chromium], instructions: Instructions.chromium },

  // FIXME: add other formats and remove `Partial` from export
] as const;

/** Describes which loaders are available for each import type */
export const Importers: Partial<Record<ImportType, ImporterMetadata>> = deepFreeze(
  Object.fromEntries(importers.map((i) => [i.id, i])),
);
