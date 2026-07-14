/**
 * This contains the types for the Autofill IPC channels.
 * To add a new IPC channel, you must
 * - Define the incoming IPC channel name in {@link AutofillIpcChannelIncoming}.
 * - Optionally, if the request expects a response, define the outgoing IPC channel name in {@link AutofillIpcChannelOutgoing}.
 * - Associate the incoming and outgoing channel names and request and response types in {@link AutofillIpcDefinitionMap}.
 * - Add the listener in both `../main/main-desktop-autofill.service.ts` and `../preload.ts` {@link ipc.autofill}.
 */

import type { autofill } from "@bitwarden/desktop-napi";
type LockStatusResponse = autofill.LockStatusResponse;
type NativeStatus = autofill.NativeStatus;
type PasskeyAssertionRequest = autofill.PasskeyAssertionRequest;
type PasskeyAssertionResponse = autofill.PasskeyAssertionResponse;
type PasskeyAssertionWithoutUserInterfaceRequest =
  autofill.PasskeyAssertionWithoutUserInterfaceRequest;
type PasskeyRegistrationResponse = autofill.PasskeyRegistrationResponse;
type PasskeyRegistrationRequest = autofill.PasskeyRegistrationRequest;
// Note that WindowHandleQueryResponse is implemented directly in the main
// process and does not need to touch the renderer process, so we don't register it here.

export const AutofillIpcChannelIncoming = Object.freeze({
  CancelRequest: "autofill.cancelRequest",
  LockStatus: "autofill.lockStatus",
  NativeStatus: "autofill.nativeStatus",
  PasskeyAssertion: "autofill.passkeyAssertion",
  PasskeyAssertionWithoutUserInterface: "autofill.passkeyAssertionWithoutUserInterface",
  PasskeyRegistration: "autofill.passkeyRegistration",
} as const);
export type AutofillIpcChannelIncoming =
  (typeof AutofillIpcChannelIncoming)[keyof typeof AutofillIpcChannelIncoming];

export const AutofillIpcChannelOutgoing = Object.freeze({
  Error: "autofill.completeError",
  LockStatus: "autofill.completeLockStatus",
  PasskeyAssertion: "autofill.completePasskeyAssertion",
  PasskeyRegistration: "autofill.completePasskeyRegistration",
} as const);
export type AutofillIpcChannelOutgoing =
  (typeof AutofillIpcChannelOutgoing)[keyof typeof AutofillIpcChannelOutgoing];

/**
 * Correlates each incoming Autofill IPC channel with its outgoing (completion) channel and the
 * request/response payload types. Channels are named from the **renderer's** perspective: the
 * renderer listens on the incoming channel and replies on the outgoing channel, while the main
 * process sends on the incoming channel and listens on the outgoing channel.
 *
 * `outgoing?: never` marks a fire-and-forget channel that expects no response.
 */
export type AutofillIpcDefinitionMap = {
  [AutofillIpcChannelIncoming.CancelRequest]: {
    request: string;
    response: void;
    outgoing?: never;
  };
  [AutofillIpcChannelIncoming.LockStatus]: {
    request: void;
    response: LockStatusResponse;
    outgoing: typeof AutofillIpcChannelOutgoing.LockStatus;
  };
  [AutofillIpcChannelIncoming.NativeStatus]: {
    request: NativeStatus;
    response: void;
    outgoing?: never;
  };
  [AutofillIpcChannelIncoming.PasskeyAssertion]: {
    request: PasskeyAssertionRequest;
    response: PasskeyAssertionResponse;
    outgoing: typeof AutofillIpcChannelOutgoing.PasskeyAssertion;
  };
  [AutofillIpcChannelIncoming.PasskeyAssertionWithoutUserInterface]: {
    request: PasskeyAssertionWithoutUserInterfaceRequest;
    response: PasskeyAssertionResponse;
    outgoing: typeof AutofillIpcChannelOutgoing.PasskeyAssertion;
  };
  [AutofillIpcChannelIncoming.PasskeyRegistration]: {
    request: PasskeyRegistrationRequest;
    response: PasskeyRegistrationResponse;
    outgoing: typeof AutofillIpcChannelOutgoing.PasskeyRegistration;
  };
};

/** The request payload type for a given incoming Autofill IPC channel. */
export type AutofillIpcRequest<K extends AutofillIpcChannelIncoming> =
  AutofillIpcDefinitionMap[K]["request"];
/** The response payload type for a given incoming Autofill IPC channel. */
export type AutofillIpcResponse<K extends AutofillIpcChannelIncoming> =
  AutofillIpcDefinitionMap[K]["response"];

/**
 * Autofill control channels that are not request/response pairs (no completion channel or payload
 * correlation).
 */
export const AutofillIpcChannelControl = Object.freeze({
  ListenerReady: "autofill.listenerReady",
  RunCommand: "autofill.runCommand",
} as const);
