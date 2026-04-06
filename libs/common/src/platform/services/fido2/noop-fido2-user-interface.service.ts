import {
  Fido2UserInterfaceService as Fido2UserInterfaceServiceAbstraction,
  Fido2UserInterfaceSession,
} from "../../abstractions/fido2/fido2-user-interface.service.abstraction";

/**
 * Noop implementation of the {@link Fido2UserInterfaceService}.
 * This implementation does not provide any user interface.
 */
export class Fido2UserInterfaceService implements Fido2UserInterfaceServiceAbstraction<void> {
  newSession(): Promise<Fido2UserInterfaceSession> {
    throw new Error("Not implemented exception");
  }
}
