import { firstValueFrom } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { Guid } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { EncString } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { Receive } from "../models/receive";
import { ReceiveCreateInput } from "../models/receive-create-input";
import { CreateReceiveRequest } from "../models/requests/create-receive.request";

import { ReceiveService } from "./receive.service";

interface ReceiveKeys {
  sharedContentEncryptionKey: SymmetricCryptoKey;
  scekWrappedPublicKey: EncString;
  userKeyWrappedSharedContentEncryptionKey: EncString;
  userKeyWrappedPrivateKey: EncString;
}

export class DefaultReceiveService implements ReceiveService {
  constructor(
    private encryptService: EncryptService,
    private keyService: KeyService,
    private keyGenerationService: KeyGenerationService,
  ) {}

  async create(input: ReceiveCreateInput, userId: UserId): Promise<Receive> {
    const receiveKeys = await this.makeReceiveKeys(userId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const requestPayload = await this.getCreateReceiveRequest(input, receiveKeys);

    // TODO call an API endpoint to create the receive and return the result.

    // TODO return the created receive from the API instead of making a fake one here.
    const receive: Receive = {
      id: newGuid() as Guid,
    };
    return receive;
  }

  private async getCreateReceiveRequest(
    input: ReceiveCreateInput,
    receiveKeys: ReceiveKeys,
  ): Promise<CreateReceiveRequest> {
    const encryptedName = await this.encryptService.encryptString(
      input.name,
      receiveKeys.sharedContentEncryptionKey,
    );
    return {
      name: encryptedName.encryptedString!,
      scekWrappedPublicKey: receiveKeys.scekWrappedPublicKey,
      userKeyWrappedSharedContentEncryptionKey:
        receiveKeys.userKeyWrappedSharedContentEncryptionKey,
      userKeyWrappedPrivateKey: receiveKeys.userKeyWrappedPrivateKey,
      expirationDate: input.expirationDate.toISOString(),
    };
  }

  private async makeReceiveKeys(userId: UserId): Promise<ReceiveKeys> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (!userKey) {
      throw new Error("User key not found for user: " + userId);
    }

    const sharedContentEncryptionKey = await this.keyGenerationService.createKey(512);
    const [b64PublicKey, userKeyWrappedPrivateKey] = await this.keyService.makeKeyPair(userKey);
    const scekWrappedPublicKey = await this.encryptService.wrapEncapsulationKey(
      Utils.fromB64ToArray(b64PublicKey),
      sharedContentEncryptionKey,
    );

    const userKeyWrappedSharedContentEncryptionKey = await this.encryptService.wrapSymmetricKey(
      sharedContentEncryptionKey,
      userKey,
    );

    if (
      !scekWrappedPublicKey.encryptedString ||
      !userKeyWrappedSharedContentEncryptionKey.encryptedString ||
      !userKeyWrappedPrivateKey.encryptedString
    ) {
      throw new Error("Failed to produce encrypted strings for receive keys");
    }

    return {
      sharedContentEncryptionKey,
      scekWrappedPublicKey: scekWrappedPublicKey.encryptedString,
      userKeyWrappedSharedContentEncryptionKey:
        userKeyWrappedSharedContentEncryptionKey.encryptedString,
      userKeyWrappedPrivateKey: userKeyWrappedPrivateKey.encryptedString,
    };
  }
}
