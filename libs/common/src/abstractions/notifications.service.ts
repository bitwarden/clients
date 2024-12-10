// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
export abstract class NotificationsService {
  init: () => Promise<void>;
  updateConnection: (sync?: boolean) => Promise<void>;
  reconnectFromActivity: () => Promise<void>;
  disconnectFromInactivity: () => Promise<void>;
}
