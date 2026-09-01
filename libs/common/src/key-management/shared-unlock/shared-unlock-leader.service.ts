export abstract class SharedUnlockLeaderService {
  abstract start(): Promise<void>;
}
