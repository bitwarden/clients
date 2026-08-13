import { ClientType } from "@bitwarden/client-type";

import { LoaderAvailability } from "./metadata";
import { ImportOptionData, ImportType } from "./models";

/** Lookup the loaders supported by a specific client, filtered from the format's declared
 *  `loaders` against `LoaderAvailability`.
 */
export function availableLoaders(
  options: Record<ImportType, ImportOptionData>,
  type: ImportType,
  client: ClientType,
) {
  return options[type].loaders.filter((loader) => LoaderAvailability[loader].includes(client));
}
