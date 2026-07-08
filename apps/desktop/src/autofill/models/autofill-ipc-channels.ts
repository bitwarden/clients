/**
 * This contains the types for the Autofill IPC channels.
 * To add a new IPC channel, you must
 * - Define the incoming IPC channel name in {@link AutofillIpcChannelIncoming}.
 * - Optionally, if the request expects a response, define the outgoing IPC channel name in {@link AutofillIpcChannelOutgoing}.
 * - Add the listener in both `../main/main-desktop-autofill.service.ts` and `../preload.ts` {@link ipc.autofill}.
 */

export const AutofillIpcChannelIncoming = Object.freeze({
  NativeStatus: "autofill.nativeStatus",
  PasskeyAssertion: "autofill.passkeyAssertion",
  PasskeyAssertionWithoutUserInterface: "autofill.passkeyAssertionWithoutUserInterface",
  PasskeyRegistration: "autofill.passkeyRegistration",
} as const);
export type AutofillIpcChannelIncoming =
  (typeof AutofillIpcChannelIncoming)[keyof typeof AutofillIpcChannelIncoming];

export const AutofillIpcChannelOutgoing = Object.freeze({
  Error: "autofill.completeError",
  PasskeyAssertion: "autofill.completePasskeyAssertion",
  PasskeyRegistration: "autofill.completePasskeyRegistration",
} as const);
export type AutofillIpcChannelOutgoing =
  (typeof AutofillIpcChannelOutgoing)[keyof typeof AutofillIpcChannelOutgoing];

/**
 * Autofill control channels that are not request/response pairs (no completion channel or payload
 * correlation).
 */
export const AutofillIpcChannelControl = Object.freeze({
  ListenerReady: "autofill.listenerReady",
  RunCommand: "autofill.runCommand",
} as const);
