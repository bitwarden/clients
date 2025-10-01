import { deepFreeze } from "@bitwarden/common/tools/util";

import { ImportType } from "../models";

import { ImporterMetadata } from "./types";

// Browser builds won't have desktop native metadata available
export const Importers: Partial<Record<ImportType, ImporterMetadata>> = deepFreeze({});
