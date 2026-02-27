export interface MessageBase {
  command: string;
}

/**
 * @deprecated Use the observable from the appropriate service instead.
 */
export abstract class BroadcasterService {
  /**
   * @deprecated Use the observable from the appropriate service instead.
   */
  abstract subscribe(id: string, messageCallback: (message: MessageBase) => void): void;
  /**
   * @deprecated Use the observable from the appropriate service instead.
   */
  abstract unsubscribe(id: string): void;
}
