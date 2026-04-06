// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, firstValueFrom } from "rxjs";

import { ActiveUserState, CombinedState, StateProvider } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import { SendData } from "../models/data/send.data";
import { SendView } from "../models/view/send.view";

import { SEND_USER_DECRYPTED, SEND_USER_ENCRYPTED } from "./key-definitions";
import { SendStateProvider as SendStateProviderAbstraction } from "./send-state.provider.abstraction";

/** State provider for sends */
export class SendStateProvider implements SendStateProviderAbstraction {
  /** Observable for the encrypted sends for an active user */
  encryptedState$: Observable<CombinedState<Record<string, SendData>>>;
  /** Observable with the decrypted sends for an active user */
  decryptedState$: Observable<SendView[]>;

  private activeUserEncryptedState: ActiveUserState<Record<string, SendData>>;
  private activeUserDecryptedState: ActiveUserState<SendView[]>;

  constructor(protected stateProvider: StateProvider) {
    this.activeUserEncryptedState = this.stateProvider.getActive(SEND_USER_ENCRYPTED);
    this.encryptedState$ = this.activeUserEncryptedState.combinedState$;

    this.activeUserDecryptedState = this.stateProvider.getActive(SEND_USER_DECRYPTED);
    this.decryptedState$ = this.activeUserDecryptedState.state$;
  }

  /** Gets the encrypted sends from state for an active user */
  async getEncryptedSends(): Promise<CombinedState<{ [id: string]: SendData }>> {
    return await firstValueFrom(this.encryptedState$);
  }

  /** Sets the encrypted send state for an active user */
  async setEncryptedSends(value: { [id: string]: SendData }, userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, SEND_USER_ENCRYPTED).update(() => value);
  }

  /** Gets the decrypted sends from state for the active user */
  async getDecryptedSends(): Promise<SendView[]> {
    return await firstValueFrom(this.decryptedState$);
  }

  /** Sets the decrypted send state for an active user */
  async setDecryptedSends(value: SendView[]): Promise<void> {
    await this.activeUserDecryptedState.update(() => value);
  }
}
