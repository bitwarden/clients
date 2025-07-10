// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { filter, map } from "rxjs";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { SingleUserState, StateProvider } from "@bitwarden/common/platform/state";
import { UserKeyEncryptor } from "@bitwarden/common/tools/cryptography/user-key-encryptor";
import { BufferedState } from "@bitwarden/common/tools/state/buffered-state";
import { PaddedDataPacker } from "@bitwarden/common/tools/state/padded-data-packer";
import { SecretState } from "@bitwarden/common/tools/state/secret-state";
import { UserId } from "@bitwarden/common/types/guid";
import { CredentialType } from "@bitwarden/generator-core";
import { KeyService } from "@bitwarden/key-management";

import { GeneratedCredential } from "./generated-credential";
import { GeneratorHistoryService } from "./generator-history.abstraction";
import { GENERATOR_HISTORY, GENERATOR_HISTORY_BUFFER } from "./key-definitions";
import { LegacyPasswordHistoryDecryptor } from "./legacy-password-history-decryptor";
import { HistoryServiceOptions } from "./options";

const OPTIONS_FRAME_SIZE = 2048;

/** Tracks the history of password generations local to a device.
 *  {@link GeneratorHistoryService}
 */
export class LocalGeneratorHistoryService extends GeneratorHistoryService {
  constructor(
    private readonly encryptService: EncryptService,
    private readonly keyService: KeyService,
    private readonly stateProvider: StateProvider,
    private readonly options: HistoryServiceOptions = { maxTotal: 200 },
  ) {
    super();
  }

  private _credentialStates = new Map<UserId, SingleUserState<GeneratedCredential[]>>();

  /** {@link GeneratorHistoryService.track} */
  track = async (userId: UserId, credential: string, category: CredentialType, date?: Date) => {
    const state = this.getCredentialState(userId);
    let result: GeneratedCredential = null;

    await state.update(
      (credentials) => {
        credentials = credentials ?? [];

        // add the result
        result = new GeneratedCredential(credential, category, date ?? Date.now());
        credentials.unshift(result);

        // trim history
        const removeAt = Math.max(0, this.options.maxTotal);
        credentials.splice(removeAt, Infinity);

        return credentials;
      },
      {
        shouldUpdate: (credentials) =>
          !(credentials?.some((f) => f.credential === credential) ?? false),
      },
    );

    return result;
  };

  /** {@link GeneratorHistoryService.take} */
  take = async (userId: UserId, credential: string) => {
    const state = this.getCredentialState(userId);
    let credentialIndex: number;
    let result: GeneratedCredential = null;

    await state.update(
      (credentials) => {
        credentials = credentials ?? [];

        [result] = credentials.splice(credentialIndex, 1);
        return credentials;
      },
      {
        shouldUpdate: (credentials) => {
          credentialIndex = credentials?.findIndex((f) => f.credential === credential) ?? -1;
          return credentialIndex >= 0;
        },
      },
    );

    return result;
  };

  /** {@link GeneratorHistoryService.take} */
  clear = async (userId: UserId) => {
    const state = this.getCredentialState(userId);
    const result = (await state.update(() => null)) ?? [];
    return result;
  };

  /** {@link GeneratorHistoryService.credentials$} */
  credentials$ = (userId: UserId) => {
    return this.getCredentialState(userId).state$.pipe(map((credentials) => credentials ?? []));
  };

  private getCredentialState(userId: UserId) {
    let state = this._credentialStates.get(userId);

    if (!state) {
      state = this.createSecretState(userId);
      this._credentialStates.set(userId, state);
    }

    return state;
  }

  private createSecretState(userId: UserId): SingleUserState<GeneratedCredential[]> {
    // construct the encryptor
    const packer = new PaddedDataPacker(OPTIONS_FRAME_SIZE);
    const encryptor$ = this.keyService.userKey$(userId).pipe(
      map((key) => (key ? new UserKeyEncryptor(userId, this.encryptService, key, packer) : null)),
      filter((encryptor) => !!encryptor),
    );

    // construct the durable state
    const state = SecretState.from<
      GeneratedCredential[],
      number,
      GeneratedCredential,
      Record<keyof GeneratedCredential, never>,
      GeneratedCredential
    >(userId, GENERATOR_HISTORY, this.stateProvider, encryptor$);

    // decryptor is just an algorithm, but it can't run until the key is available;
    // providing it via an observable makes running it early impossible
    const decryptor = new LegacyPasswordHistoryDecryptor(
      userId,
      this.keyService,
      this.encryptService,
    );
    const decryptor$ = this.keyService.userKey$(userId).pipe(map((key) => key && decryptor));

    // move data from the old password history once decryptor is available
    const buffer = new BufferedState(
      this.stateProvider,
      GENERATOR_HISTORY_BUFFER,
      state,
      decryptor$,
    );

    return buffer;
  }
}
