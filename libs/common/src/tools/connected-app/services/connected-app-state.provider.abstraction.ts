// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";
import type { Simplify } from "type-fest";

import { CombinedState } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { ConnectedAppData } from "../models/data/connected-app.data";

type EncryptedConnectedAppState = Simplify<CombinedState<Record<string, ConnectedAppData>>>;

export abstract class ConnectedAppStateProvider {
  encryptedState$: Observable<EncryptedConnectedAppState>;

  getEncryptedConnectedApps: () => Promise<EncryptedConnectedAppState>;

  setEncryptedConnectedApps: (
    value: Record<string, ConnectedAppData>,
    userId: UserId,
  ) => Promise<void>;
}
