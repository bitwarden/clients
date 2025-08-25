import { ClientType } from "@bitwarden/client-type";

import { LoaderAvailability, Importers } from "./metadata";
import { ImportType } from "./models";

/** Lookup the loaders supported by a specific client.
 *  WARNING: this method does not supply metadata for every import type.
 *  @returns `undefined` when metadata is not defined for the type, or
 *   an array identifying the supported clients.
 */
export function availableLoaders(type: ImportType, client: ClientType) {
  if (!(type in Importers)) {
    return undefined;
  }

  const capabilities = Importers[type]?.loaders ?? [];
  const available = capabilities.filter((loader) => LoaderAvailability[loader].includes(client));
  return available;
}
