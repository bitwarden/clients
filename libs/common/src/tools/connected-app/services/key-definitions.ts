import { CONNECTED_APP_DISK, UserKeyDefinition } from "../../../platform/state";
import { ConnectedAppData } from "../models/data/connected-app.data";

/** Encrypted connected-app state (keyed by connection id) stored on disk. */
export const CONNECTED_APP_USER_ENCRYPTED = UserKeyDefinition.record<ConnectedAppData>(
  CONNECTED_APP_DISK,
  "connectedAppUserEncrypted",
  {
    deserializer: (obj: ConnectedAppData) => obj,
    clearOn: ["logout"],
  },
);
