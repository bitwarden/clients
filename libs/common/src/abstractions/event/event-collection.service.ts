import { EventType } from "../../enums";
import { CipherView } from "../../vault/models/view/cipher.view";

export abstract class EventCollectionService {
  abstract collectMany(
    eventType: EventType,
    ciphers: CipherView[],
    uploadImmediately?: boolean,
  ): Promise<any>;
  abstract collect(
    eventType: EventType,
    cipherId?: string,
    uploadImmediately?: boolean,
    organizationId?: string,
  ): Promise<any>;
}
