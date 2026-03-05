import { ClientType } from "@bitwarden/client-type";
import { deepFreeze } from "@bitwarden/common/tools/util";

import { Loader } from "./data";
import { DataLoader } from "./types";

/** Describes which loaders are supported on each client */
export const LoaderAvailability: Record<DataLoader, ClientType[]> = deepFreeze({
  [Loader.chromium]: [ClientType.Desktop],
  [Loader.download]: [ClientType.Browser],
  [Loader.file]: [ClientType.Browser, ClientType.Desktop, ClientType.Web, ClientType.Cli],

  // FIXME: enable IPC importer on `ClientType.Desktop` once it's ready
  [Loader.ipc]: [],
});
