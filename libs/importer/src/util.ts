import { ClientType } from "@bitwarden/client-type";

import { LoaderAvailability } from "./metadata";
import { ImportOptionData, ImportType } from "./models";

/** Lookup the loaders supported by a specific client, filtered from the format's declared
 *  `loaders` against `LoaderAvailability`.
 *  @returns an empty array if `type` isn't a real `ImportType` at runtime — the type parameter is
 *   not a runtime guarantee here: callers (e.g. `ImportComponent`'s format dropdown) can emit an
 *   unvalidated value, such as the reset placeholder's `""`.
 */
export function availableLoaders(
  options: Record<ImportType, ImportOptionData>,
  type: ImportType,
  client: ClientType,
) {
  const loaders = options[type]?.loaders ?? [];
  return loaders.filter((loader) => LoaderAvailability[loader].includes(client));
}
