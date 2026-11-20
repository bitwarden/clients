import { Injectable } from "@angular/core";

/**
 * Remembers, for the current app session only, that setup was already opened automatically after
 * the user turned on the SSH agent. Turning the switch off and on again does not reopen it.
 */
@Injectable({ providedIn: "root" })
export class SshAgentSetupAutoOfferService {
  private offered = false;

  get alreadyOffered(): boolean {
    return this.offered;
  }

  /** Returns true the first time it is called, then false for the rest of the session. */
  claim(): boolean {
    if (this.offered) {
      return false;
    }
    this.offered = true;
    return true;
  }
}
