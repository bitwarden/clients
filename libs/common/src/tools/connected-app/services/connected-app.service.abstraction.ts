import { Observable } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { UserKeyRotationDataProvider } from "@bitwarden/key-management";

import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { ConnectedAppData } from "../models/data/connected-app.data";
import { ConnectedApp } from "../models/domain/connected-app";
import { ConnectedAppWithIdRequest } from "../models/request/connected-app-with-id.request";
import { ConnectedAppView } from "../models/view/connected-app.view";

export abstract class ConnectedAppService implements UserKeyRotationDataProvider<ConnectedAppWithIdRequest> {
  abstract connectedApps$: Observable<ConnectedApp[]>;
  abstract connectedAppViews$: Observable<ConnectedAppView[]>;

  /**
   * Builds an encrypted {@link ConnectedApp} by wrapping the plaintext PSK under the user key.
   * @param plaintextPsk Protected Data — the plaintext agent-access PSK. Never logged or persisted.
   */
  abstract encrypt(
    partnerClientId: string,
    name: string,
    plaintextPsk: string,
    userId: UserId,
  ): Promise<ConnectedApp>;

  /** Re-wraps each connection's PSK under the new user key for the account key-rotation flow. */
  abstract getRotatedData(
    originalUserKey: UserKey,
    newUserKey: UserKey,
    userId: UserId,
  ): Promise<ConnectedAppWithIdRequest[]>;
}

export abstract class InternalConnectedAppService extends ConnectedAppService {
  abstract upsert(connection: ConnectedAppData | ConnectedAppData[]): Promise<void>;
  abstract replace(connections: Record<string, ConnectedAppData>, userId: UserId): Promise<void>;
  abstract delete(id: string | string[]): Promise<void>;
}
