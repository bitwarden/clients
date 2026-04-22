import { CipherView } from "../../../vault/models/view/cipher.view";
import { EventType } from "../enums/event-type.enum";

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
