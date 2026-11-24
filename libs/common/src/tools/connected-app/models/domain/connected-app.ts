// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { EncryptService, EncString } from "@bitwarden/legacy-crypto";

import Domain from "../../../../platform/models/domain/domain-base";
import { UserKey } from "../../../../types/key";
import { ConnectedAppType } from "../connected-app-type";
import { ConnectedAppData } from "../data/connected-app.data";
import { ConnectedAppView } from "../view/connected-app.view";

/**
 * Domain model for an agent connection. The agent-access PSK lives in {@link key} as an
 * {@link EncString} wrapped directly under the user key (no per-item key derivation, unlike
 * `Send`). Only the user's own clients can decrypt it; the server never sees plaintext.
 */
export class ConnectedApp extends Domain {
  id: string;
  type: ConnectedAppType;
  partnerClientId: string;
  name: string;
  key: EncString;
  creationDate: Date;
  revisionDate: Date;
  revokedDate: Date | null;

  constructor(obj?: ConnectedAppData) {
    super();
    if (obj == null) {
      return;
    }

    this.id = obj.id;
    this.type = obj.type;
    this.partnerClientId = obj.partnerClientId;
    this.name = obj.name;
    this.key = obj.key != null ? new EncString(obj.key) : null;
    this.creationDate = obj.creationDate != null ? new Date(obj.creationDate) : null;
    this.revisionDate = obj.revisionDate != null ? new Date(obj.revisionDate) : null;
    this.revokedDate = obj.revokedDate != null ? new Date(obj.revokedDate) : null;
  }

  get revoked(): boolean {
    return this.revokedDate != null;
  }

  /** Decrypts the PSK with the user key, producing a {@link ConnectedAppView}. */
  async decrypt(userKey: UserKey, encryptService: EncryptService): Promise<ConnectedAppView> {
    const view = new ConnectedAppView(this);
    view.psk = this.key != null ? await encryptService.decryptString(this.key, userKey) : null;
    return view;
  }

  toConnectedAppData(): ConnectedAppData {
    const data = new ConnectedAppData();
    data.id = this.id;
    data.type = this.type;
    data.partnerClientId = this.partnerClientId;
    data.name = this.name;
    data.key = this.key?.encryptedString ?? null;
    data.creationDate = this.creationDate?.toISOString() ?? null;
    data.revisionDate = this.revisionDate?.toISOString() ?? null;
    data.revokedDate = this.revokedDate?.toISOString() ?? null;
    return data;
  }

  static fromJSON(obj: Jsonify<ConnectedApp>): ConnectedApp {
    if (obj == null) {
      return null;
    }

    return Object.assign(new ConnectedApp(), obj, {
      key: EncString.fromJSON(obj.key),
      creationDate: obj.creationDate == null ? null : new Date(obj.creationDate),
      revisionDate: obj.revisionDate == null ? null : new Date(obj.revisionDate),
      revokedDate: obj.revokedDate == null ? null : new Date(obj.revokedDate),
    });
  }
}
