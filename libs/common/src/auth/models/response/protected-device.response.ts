// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { RotateableKeySet } from "@bitwarden/auth/common";

import { DeviceType } from "../../../enums";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { BaseResponse } from "../../../models/response/base.response";

export class ProtectedDeviceResponse extends BaseResponse {
  constructor(response: Jsonify<ProtectedDeviceResponse>) {
    super(response);
    this.id = this.getResponseProperty("id");
    this.name = this.getResponseProperty("name");
    this.identifier = this.getResponseProperty("identifier");
    this.type = this.getResponseProperty("type");
    this.creationDate = new Date(this.getResponseProperty("creationDate"));
    if (response.encryptedUserKey) {
      this.encryptedUserKey = new EncString(this.getResponseProperty("encryptedUserKey"));
    }
    if (response.encryptedPublicKey) {
      this.encryptedPublicKey = new EncString(this.getResponseProperty("encryptedPublicKey"));
    }
  }

  id: string;
  name: string;
  type: DeviceType;
  identifier: string;
  creationDate: Date;
  /**
   * Intended to be the users symmetric key that is encrypted in some form, the current way to encrypt this is with
   * the devices public key.
   */
  encryptedUserKey: EncString;
  /**
   * Intended to be the public key that was generated for a device upon trust and encrypted. Currenly encrypted using
   * a users symmetric key so that when trusted and unlocked a user can decrypt the public key for all their devices.
   * This enabled a user to rotate the keys for all of their devices.
   */
  encryptedPublicKey: EncString;

  getRotateableKeyset(): RotateableKeySet {
    return new RotateableKeySet(this.encryptedUserKey, this.encryptedPublicKey);
  }

  isTrusted(): boolean {
    return this.encryptedUserKey != null && this.encryptedPublicKey != null;
  }
}
