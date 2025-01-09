export abstract class AppIdService {
  abstract getAppId(): Promise<string>;
  abstract getAnonymousAppId(): Promise<string>;
}
