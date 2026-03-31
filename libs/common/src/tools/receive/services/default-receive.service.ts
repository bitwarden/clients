import { combineLatest, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { ReceiveData } from "../models/data/receive.data";
import { Receive } from "../models/domain/receive";
import { ReceiveFile } from "../models/domain/receive-file";
import { ReceiveCreateInput } from "../models/receive-create-input";
import { ReceiveSharedData } from "../models/receive-shared-data";
import { ReceiveUrlData } from "../models/receive-url-data";
import { CreateReceiveRequest } from "../models/requests/create-receive.request";
import { UpdateReceiveRequest } from "../models/requests/update-receive.request";
import { ReceiveSharedDataResponse } from "../models/response/receive-shared-data.response";
import { ReceiveFileView } from "../models/view/receive-file.view";
import { ReceiveView } from "../models/view/receive.view";

import { ReceiveApiService } from "./receive-api.service";
import { InternalReceiveService } from "./receive.service";
import { RECEIVE_ENCRYPTED_RECEIVES } from "./receive.state";

interface ReceiveKeys {
  sharedContentEncryptionKey: SymmetricCryptoKey;
  scekWrappedPublicKey: EncString;
  userKeyWrappedSharedContentEncryptionKey: EncString;
  userKeyWrappedPrivateKey: EncString;
}

export class DefaultReceiveService implements InternalReceiveService {
  constructor(
    private encryptService: EncryptService,
    private keyService: KeyService,
    private keyGenerationService: KeyGenerationService,
    private receiveApiService: ReceiveApiService,
    private stateProvider: StateProvider,
  ) {}

  receives$(userId: UserId): Observable<Receive[]> {
    return this.stateProvider.getUser(userId, RECEIVE_ENCRYPTED_RECEIVES).state$.pipe(
      map((receives) => {
        if (receives == null) {
          return [];
        }

        return Object.values(receives).map((r) => new Receive(r));
      }),
    );
  }

  receiveViews$(userId: UserId): Observable<ReceiveView[]> {
    return combineLatest([this.receives$(userId), this.keyService.userKey$(userId)]).pipe(
      switchMap(([receives, userKey]) => {
        if (!userKey) {
          return of([]);
        }
        return Promise.all(receives.map((receive) => this.decryptReceive(receive, userKey)));
      }),
    );
  }

  async create(input: ReceiveCreateInput, userId: UserId): Promise<ReceiveView> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (!userKey) {
      throw new Error("User key not found for user: " + userId);
    }

    const receiveKeys = await this.makeReceiveKeys(userKey);
    const requestPayload = await this.getCreateReceiveRequest(input, receiveKeys);

    const response = await this.receiveApiService.postReceive(requestPayload);
    const data = new ReceiveData(response);

    await this.upsert(data, userId);
    return await this.decryptReceive(new Receive(data), userKey);
  }

  async update(receiveView: ReceiveView, userId: UserId): Promise<void> {
    const updateRequest = await this.getUpdateReceiveRequest(receiveView);
    const response = await this.receiveApiService.putReceive(receiveView.id, updateRequest);
    const data = new ReceiveData(response);
    await this.upsert(data, userId);
  }

  async getSharedData(urlData: ReceiveUrlData): Promise<ReceiveSharedData> {
    const response = await this.receiveApiService.postReceiveAccess(
      urlData.receiveId,
      urlData.secretB64,
    );

    return await this.decryptResponse(response, urlData);
  }

  async upsert(receiveData: ReceiveData | ReceiveData[], userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, RECEIVE_ENCRYPTED_RECEIVES).update((receives) => {
      if (receives == null) {
        receives = {};
      }
      if (receiveData instanceof ReceiveData) {
        const r = receiveData as ReceiveData;
        receives[r.id] = r;
      } else {
        (receiveData as ReceiveData[]).forEach((r) => {
          receives[r.id] = r;
        });
      }

      return receives;
    });
  }

  async replace(receives: { [id: string]: ReceiveData }, userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, RECEIVE_ENCRYPTED_RECEIVES).update(() => receives);
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

  private async getUpdateReceiveRequest(receiveView: ReceiveView): Promise<UpdateReceiveRequest> {
    const encryptedName = await this.encryptService.encryptString(
      receiveView.name,
      receiveView.sharedContentEncryptionKey,
    );

    return new UpdateReceiveRequest(encryptedName, receiveView.expirationDate);
  }

  private async makeReceiveKeys(userKey: UserKey): Promise<ReceiveKeys> {
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

  private async decryptReceive(receive: Receive, userKey: UserKey): Promise<ReceiveView> {
    if (!userKey) {
      throw new Error("User key is required");
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
