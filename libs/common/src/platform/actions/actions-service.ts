export abstract class ActionsService {
  /**
   * Opens the popup if it is supported.
   */
  abstract openPopup(): Promise<void>;
}
