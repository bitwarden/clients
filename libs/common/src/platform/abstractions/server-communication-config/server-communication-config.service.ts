/**
 * Service for managing server communication configuration,
 * including bootstrap detection and cookie management.
 */
export abstract class ServerCommunicationConfigService {
  /**
   * Initializes the service and creates the SDK-based ServerCommunicationConfigClient
   */
  abstract init(): Promise<void>;
}
