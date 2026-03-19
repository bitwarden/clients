import { deepFreeze } from "@bitwarden/common/tools/util";

import { ImportType } from "../models";

import { Instructions, Loader } from "./data";
import { ImporterMetadata } from "./types";

export type ImportersMetadata = Partial<Record<ImportType, ImporterMetadata>>;

/** List of all supported importers and their default capabilities
 * Note: the loaders listed here are the ones that are supported in all clients.
 * Specific clients may have additional loaders available based on platform capabilities.
 */
const importers = [
  { id: "bitwardenjson", loaders: [Loader.file], instructions: Instructions.unique },
  // chromecsv import depends upon operating system, so ironically it doesn't support chromium
  { id: "chromecsv", loaders: [Loader.file], instructions: Instructions.chromium },
  { id: "operacsv", loaders: [Loader.file], instructions: Instructions.chromium },
  {
    id: "vivaldicsv",
    loaders: [Loader.file],
    instructions: Instructions.chromium,
  },
  { id: "bravecsv", loaders: [Loader.file], instructions: Instructions.chromium },
  { id: "edgecsv", loaders: [Loader.file], instructions: Instructions.chromium },

  // FIXME: add other formats and remove `Partial` from export
] as const;

/** Describes which loaders are available for each import type */
export const Importers: ImportersMetadata = deepFreeze(
  Object.fromEntries(importers.map((i) => [i.id, i])),
);
