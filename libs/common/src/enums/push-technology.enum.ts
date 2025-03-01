/**
 * The preferred push technology of the server.
 */
export enum PushTechnology {
  /**
   * Indicates that we should use SignalR over web sockets to receive push notifications from the server.
   */
  SignalR = 0,
  /**
   * Indicatates that we should use WebPush to receive push notifications from the server.
   */
  WebPush = 1,
}
