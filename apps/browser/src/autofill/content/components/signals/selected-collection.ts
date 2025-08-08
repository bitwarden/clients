import { signal } from "@lit-labs/signals";

import { CollectionId } from "@bitwarden/common/types/guid";

export const selectedCollection = signal<CollectionId>("0" as CollectionId);
