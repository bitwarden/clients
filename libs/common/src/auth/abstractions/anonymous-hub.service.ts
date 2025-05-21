// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export abstract class AnonymousHubService {
  createHubConnection: (token: string) => Promise<void>;
  stopHubConnection: () => Promise<void>;
}
