import { Component, input } from "@angular/core";
import { AbstractControl, UntypedFormGroup } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-error-summary",
  template: ` @if (errorCount > 0) {
    <i class="bwi bwi-error"></i> {{ "fieldsNeedAttention" | i18n: errorString }}
  }`,
  host: {
    class: "tw-block tw-text-danger tw-mt-2",
    "aria-live": "assertive",
  },
  imports: [I18nPipe],
})
export class BitErrorSummary {
  readonly formGroup = input<UntypedFormGroup>();

  get errorCount(): number {
    const form = this.formGroup();
    return form ? this.getErrorCount(form) : 0;
  }

  get errorString() {
    return this.errorCount.toString();
  }

  private getErrorCount(form: UntypedFormGroup): number {
    return Object.values(form.controls).reduce((acc: number, control: AbstractControl) => {
      if (control instanceof UntypedFormGroup) {
        return acc + this.getErrorCount(control);
      }

      if (control.errors == null) {
        return acc;
      }

      if (!control.dirty && control.untouched) {
        return acc;
      }

      return acc + Object.keys(control.errors).length;
    }, 0);
  }
}
