import { inject, Injectable } from "@angular/core";
import { FormControl } from "@angular/forms";
import { BehaviorSubject, distinctUntilChanged } from "rxjs";

import { UriMatchStrategySetting } from "@bitwarden/common/models/domain/domain-service";
import { DialogService } from "@bitwarden/components";

/**
 * Coordinates the HTTP authentication (browser login prompt) setting across the cipher form sections.
 *
 * HTTP authentication is mutually exclusive with master password reprompt, and only applies when every
 * URI on the cipher has an explicitly chosen match strategy. The setting is rendered in the
 * additional options section, while the URIs live in the autofill options section, so both
 * sections share this form-scoped service.
 */
@Injectable()
export class CipherFormHTTPAuthenticationService {
  private dialogService = inject(DialogService);

  /** The HTTP authentication setting for the cipher being edited. */
  readonly httpAuthenticationControl = new FormControl<boolean>(false, { nonNullable: true });

  private readonly allUrisHaveExplicitMatchStrategySubject = new BehaviorSubject<boolean>(true);

  /**
   * Emits true when every URI on the cipher has an explicitly chosen match strategy. A cipher
   * with no URIs emits true.
   */
  readonly allUrisHaveExplicitMatchStrategy$ =
    this.allUrisHaveExplicitMatchStrategySubject.pipe(distinctUntilChanged());

  /**
   * True while a confirmation that may turn HTTP authentication off is open. A URI change that is being
   * confirmed reaches the form before the user responds, so enforcement waits for the answer.
   */
  private confirmationPending = false;

  /**
   * Records the current URI match strategies. When any URI uses the default strategy, HTTP authentication
   * is turned off unless a confirmation for that change is still open.
   */
  updateUriMatchStrategies(matchStrategies: UriMatchStrategySetting[]) {
    const allExplicit = matchStrategies.every((matchStrategy) => matchStrategy != null);

    if (!allExplicit && this.httpAuthenticationControl.value && !this.confirmationPending) {
      this.httpAuthenticationControl.setValue(false);
    }

    this.allUrisHaveExplicitMatchStrategySubject.next(allExplicit);
  }

  /**
   * Asks the user to confirm turning on HTTP authentication, which turns off master password reprompt.
   * @returns true when the user confirms.
   */
  confirmTurnOnHTTPAuthentication(): Promise<boolean> {
    return this.dialogService.openSimpleDialog({
      title: { key: "turnOnHttpAuthenticationTitle" },
      content: { key: "turnOnHttpAuthenticationRepromptConflictPrompt" },
      type: "warning",
      acceptButtonText: { key: "continue" },
    });
  }

  /**
   * Asks the user to confirm turning on master password reprompt, which turns off HTTP authentication.
   * @returns true when the user confirms.
   */
  confirmTurnOnReprompt(): Promise<boolean> {
    return this.dialogService.openSimpleDialog({
      title: { key: "turnOnPasswordRepromptTitle" },
      content: { key: "turnOnPasswordRepromptHttpAuthenticationConflictPrompt" },
      type: "warning",
      acceptButtonText: { key: "continue" },
    });
  }

  /**
   * Asks the user to confirm using the default match strategy on a URI while HTTP authentication is on.
   * HTTP authentication is turned off when the user confirms. Resolves to true immediately when HTTP authentication
   * is already off.
   * @returns true when the default match strategy can be used.
   */
  async confirmDefaultMatchStrategy(): Promise<boolean> {
    if (!this.httpAuthenticationControl.value) {
      return true;
    }

    this.confirmationPending = true;

    try {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "useDefaultMatchDetectionTitle" },
        content: { key: "useDefaultMatchDetectionHttpAuthenticationConflictPrompt" },
        type: "warning",
        acceptButtonText: { key: "continue" },
      });

      if (confirmed) {
        this.httpAuthenticationControl.setValue(false);
      }

      return confirmed;
    } finally {
      this.confirmationPending = false;
    }
  }

  /**
   * Resolves the HTTP authentication value for a cipher being loaded into the form. Reprompt takes
   * priority, so HTTP authentication is turned off when both are on and the user is told about the change.
   * @returns the HTTP authentication value to use in the form.
   */
  async resolveInitialHTTPAuthentication(
    httpAuthentication: boolean,
    reprompt: boolean,
  ): Promise<boolean> {
    if (!httpAuthentication || !reprompt) {
      return httpAuthentication;
    }

    await this.dialogService.openSimpleDialog({
      title: { key: "httpAuthenticationTurnedOffTitle" },
      content: { key: "httpAuthenticationTurnedOffNotice" },
      type: "info",
      acceptButtonText: { key: "ok" },
      cancelButtonText: null,
    });

    return false;
  }
}
