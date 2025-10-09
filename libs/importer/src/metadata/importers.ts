import { ImportType } from "../models";

import { ImporterMetadata } from "./types";

export type ImportersMetadata = Partial<Record<ImportType, ImporterMetadata>>;
