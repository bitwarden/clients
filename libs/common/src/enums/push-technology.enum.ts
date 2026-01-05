/**
 * The preferred push technology of the server.
 */
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum PushTechnology {
  /**
   * Indicates that we should use SignalR over web sockets to receive push server notifications from the server.
   */
  SignalR = 0,
  /**
   * Indicates that we should use WebPush to receive push server notifications from the server.
   */
  WebPush = 1,
}
