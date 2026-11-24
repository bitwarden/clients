// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { View } from "../../../../models/view/view";
import { ConnectedAppType } from "../connected-app-type";
import { ConnectedApp } from "../domain/connected-app";

/**
 * Decrypted view of an {@link ConnectedApp}. {@link psk} is the plaintext agent-access PSK and
 * is Protected Data — never log it or send it to the server.
 */
export class ConnectedAppView implements View {
  id: string = null;
  type: ConnectedAppType = null;
  partnerClientId: string = null;
  name: string = null;
  psk: string = null;
  creationDate: Date = null;
  revisionDate: Date = null;
  revokedDate: Date | null = null;

  constructor(c?: ConnectedApp) {
    if (c == null) {
      return;
    }

    this.id = c.id;
    this.type = c.type;
    this.partnerClientId = c.partnerClientId;
    this.name = c.name;
    this.creationDate = c.creationDate;
    this.revisionDate = c.revisionDate;
    this.revokedDate = c.revokedDate;
  }

  get revoked(): boolean {
    return this.revokedDate != null;
  }

  static fromJSON(obj: Jsonify<ConnectedAppView>): ConnectedAppView {
    if (obj == null) {
      return null;
    }

    return Object.assign(new ConnectedAppView(), obj, {
      creationDate: obj.creationDate == null ? null : new Date(obj.creationDate),
      revisionDate: obj.revisionDate == null ? null : new Date(obj.revisionDate),
      revokedDate: obj.revokedDate == null ? null : new Date(obj.revokedDate),
    });
  }
}
