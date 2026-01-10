import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { GeneratorModule } from "@bitwarden/generator-components";
import { AlgorithmInfo, GeneratedCredential } from "@bitwarden/generator-core";

/**
 * Renders a password or username generator UI and emits the most recently generated value.
 * Used by the cipher form to be shown in a dialog/modal when generating cipher passwords/usernames.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-cipher-form-generator",
  templateUrl: "./cipher-form-generator.component.html",
  imports: [CommonModule, GeneratorModule],
})
export class CipherFormGeneratorComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  uri: string = "";

  /**
   * The type of generator form to show.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true })
  type: "password" | "username" = "password";

  /** Removes bottom margin of internal sections */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  algorithmSelected = new EventEmitter<AlgorithmInfo>();

  /**
   * Emits an event when a new value is generated.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  valueGenerated = new EventEmitter<string>();

  /** Event handler for when an algorithm is selected */
  onAlgorithmSelected = (selected: AlgorithmInfo) => {
    this.algorithmSelected.emit(selected);
  };

  /** Event handler for both generation components */
  onCredentialGenerated = (generatedCred: GeneratedCredential) => {
    this.valueGenerated.emit(generatedCred.credential);
  };
}
