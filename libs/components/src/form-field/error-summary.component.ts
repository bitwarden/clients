import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { AbstractControl, UntypedFormGroup } from "@angular/forms";
import { EMPTY, switchMap } from "rxjs";

import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "bit-error-summary",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` @if (errorCount() > 0) {
    <i class="bwi bwi-error"></i> {{ "fieldsNeedAttention" | i18n: errorCount().toString() }}
  }`,
  host: {
    class: "tw-block tw-text-danger tw-mt-2",
    "aria-live": "assertive",
  },
  imports: [I18nPipe],
})
export class BitErrorSummaryComponent {
  readonly formGroup = input<UntypedFormGroup>();

  // Descendant status, touched, and pristine changes all surface on the group's `events`.
  private readonly formEvent = toSignal(
    toObservable(this.formGroup).pipe(switchMap((form) => form?.events ?? EMPTY)),
  );

  protected readonly errorCount = computed(() => {
    this.formEvent();
    const form = this.formGroup();
    return form ? this.getErrorCount(form) : 0;
  });

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
