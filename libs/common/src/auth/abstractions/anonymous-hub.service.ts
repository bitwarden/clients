export abstract class AnonymousHubService {
  abstract createHubConnection(token: string): Promise<void>;
  abstract stopHubConnection(): Promise<void>;
}
