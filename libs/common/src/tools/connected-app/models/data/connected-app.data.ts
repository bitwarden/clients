// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ConnectedAppResponse } from "../response/connected-app.response";

/**
 * The string-shaped, encrypted-at-rest representation of an {@link ConnectedApp} stored in
 * `CONNECTED_APP_USER_ENCRYPTED` state. `key` holds the user-key-encrypted PSK as an
 * `encryptedString`.
 */
export class ConnectedAppData {
  id: string;
  partnerClientId: string;
  name: string;
  key: string;
  creationDate: string;
  revisionDate: string;
  revokedDate: string | null;

  constructor(response?: ConnectedAppResponse) {
    if (response == null) {
      return;
    }

    this.id = response.id;
    this.partnerClientId = response.partnerClientId;
    this.name = response.name;
    this.key = response.key;
    this.creationDate = response.creationDate;
    this.revisionDate = response.revisionDate;
    this.revokedDate = response.revokedDate;
  }
}
