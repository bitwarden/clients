import { firstValueFrom } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { ReceiveData } from "../models/data/receive.data";
import { Receive } from "../models/domain/receive";
import { ReceiveFile } from "../models/domain/receive-file";
import { ReceiveCreateInput } from "../models/receive-create-input";
import { ReceiveSharedData } from "../models/receive-shared-data";
import { ReceiveUrlData } from "../models/receive-url-data";
import { CreateReceiveRequest } from "../models/requests/create-receive.request";
import { ReceiveSharedDataResponse } from "../models/response/receive-shared-data.response";
import { ReceiveFileView } from "../models/view/receive-file.view";
import { ReceiveView } from "../models/view/receive.view";

import { ReceiveApiService } from "./receive-api.service.abstraction";
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
    private receiveApiService: ReceiveApiService,
  ) {}

  async create(input: ReceiveCreateInput, userId: UserId): Promise<Receive> {
    const receiveKeys = await this.makeReceiveKeys(userId);
    const requestPayload = await this.getCreateReceiveRequest(input, receiveKeys);

    const response = await this.receiveApiService.postReceive(requestPayload);
    const data = new ReceiveData(response);
    return new Receive(data);
  }

  async getSharedData(urlData: ReceiveUrlData): Promise<ReceiveSharedData> {
    const response = await this.receiveApiService.postReceiveAccess(
      urlData.receiveId,
      urlData.secretB64,
    );

    return await this.decryptResponse(response, urlData);
  }

  private async decryptResponse(
    response: ReceiveSharedDataResponse,
    urlData: ReceiveUrlData,
  ): Promise<ReceiveSharedData> {
    const sharedContentEncryptionKey = SymmetricCryptoKey.fromString(
      urlData.sharedContentEncryptionKeyB64,
    );

    return {
      name: await this.encryptService.decryptString(response.name, sharedContentEncryptionKey),
      publicKey: await this.encryptService.unwrapEncapsulationKey(
        response.scekWrappedPublicKey,
        sharedContentEncryptionKey,
      ),
    };
  }

  private async getCreateReceiveRequest(
    input: ReceiveCreateInput,
    receiveKeys: ReceiveKeys,
  ): Promise<CreateReceiveRequest> {
    const encryptedName = await this.encryptService.encryptString(
      input.name,
      receiveKeys.sharedContentEncryptionKey,
    );

    return new CreateReceiveRequest(
      encryptedName,
      receiveKeys.scekWrappedPublicKey,
      receiveKeys.userKeyWrappedSharedContentEncryptionKey,
      receiveKeys.userKeyWrappedPrivateKey,
      input.expirationDate,
    );
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
      scekWrappedPublicKey: scekWrappedPublicKey,
      userKeyWrappedSharedContentEncryptionKey: userKeyWrappedSharedContentEncryptionKey,
      userKeyWrappedPrivateKey: userKeyWrappedPrivateKey,
    };
  }

  // TODO call this method when getting a receive from the API to return a ReceiveView.
  private async decryptReceive(receive: Receive, userId: UserId): Promise<ReceiveView> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (!userKey) {
      throw new Error("User key not found for user: " + userId);
    }

    const sharedContentEncryptionKey = await this.encryptService.unwrapSymmetricKey(
      receive.userKeyWrappedSharedContentEncryptionKey,
      userKey,
    );

    const view: ReceiveView = {
      id: receive.id,
      secret: receive.secret,
      expirationDate: receive.expirationDate,
      name: await this.encryptService.decryptString(receive.name, sharedContentEncryptionKey),
      publicKey: await this.encryptService.unwrapEncapsulationKey(
        receive.scekWrappedPublicKey,
        sharedContentEncryptionKey,
      ),
      sharedContentEncryptionKey,
    };

    if (receive.files.length > 0) {
      const privateKey = await this.encryptService.unwrapDecapsulationKey(
        receive.userKeyWrappedPrivateKey,
        userKey,
      );
      view.fileData = await this.decryptReceiveFiles(receive.files, privateKey);
    }

    return view;
  }

  private async decryptReceiveFiles(
    receiveFiles: ReceiveFile[],
    privateKey: Uint8Array,
  ): Promise<ReceiveFileView[]> {
    return await Promise.all(
      receiveFiles.map(async (file) => {
        const fileContentEncryptionKey = await this.encryptService.decapsulateKeyUnsigned(
          file.encapsulatedFileContentEncryptionKey,
          privateKey,
        );
        return {
          id: file.id,
          size: file.size,
          fileName: await this.encryptService.decryptString(
            file.fileName,
            fileContentEncryptionKey,
          ),
          fileContentEncryptionKey,
        };
      }),
    );
  }
}
