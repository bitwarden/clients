// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EventType } from "../../enums";
import { CipherView } from "../../vault/models/view/cipher.view";

export abstract class EventCollectionService {
  collectMany: (
    eventType: EventType,
    ciphers: CipherView[],
    uploadImmediately?: boolean,
  ) => Promise<any>;
  collect: (
    eventType: EventType,
    cipherId?: string,
    uploadImmediately?: boolean,
    organizationId?: string,
  ) => Promise<any>;
}
