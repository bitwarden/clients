import { animate, style, transition, trigger } from "@angular/animations";
import { Component } from "@angular/core";
import { NG_VALUE_ACCESSOR } from "@angular/forms";

import { UserVerificationComponent as BaseComponent } from "@bitwarden/angular/auth/components/user-verification.component";
/**
 * @deprecated Jan 24, 2024: Use new libs/auth UserVerificationDialogComponent or UserVerificationFormInputComponent instead.
 * Each client specific component should eventually be converted over to use one of these new components.
 */
@Component({
  selector: "app-user-verification",
  templateUrl: "user-verification.component.html",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: UserVerificationComponent,
    },
  ],
  animations: [
    trigger("sent", [
      transition(":enter", [style({ opacity: 0 }), animate("100ms", style({ opacity: 1 }))]),
    ]),
  ],
  standalone: false,
})
export class UserVerificationComponent extends BaseComponent {}
