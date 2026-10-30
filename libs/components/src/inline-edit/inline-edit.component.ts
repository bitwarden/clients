import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  model,
  untracked,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from "@angular/forms";

import { AsyncActionsModule } from "../async-actions";
import { FormFieldModule } from "../form-field";
import { trimValidator } from "../form-field/bit-validators";
import { IconButtonModule } from "../icon-button";
import { AutofocusDirective } from "../input/autofocus.directive";
import { InputModule } from "../input/input.module";

/**
 * Edit-in-place affordance for a single text value: shows the value with a pencil button, swapping
 * to an input with save/cancel while editing. Display text inherits the host's typography.
 */
@Component({
  selector: "bit-inline-edit",
  templateUrl: "./inline-edit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-contents",
  },
  imports: [
    ReactiveFormsModule,
    AsyncActionsModule,
    IconButtonModule,
    FormFieldModule,
    InputModule,
    AutofocusDirective,
  ],
})
export class InlineEditComponent {
  readonly value = input.required<string>();
  /** Label for the text field, used as its `aria-label`. */
  readonly label = input.required<string>();
  /** `aria-label` for the pencil (edit) button. */
  readonly editLabel = input.required<string>();
  /** `aria-label` for the save button. */
  readonly saveLabel = input.required<string>();
  /** `aria-label` for the cancel button. */
  readonly cancelLabel = input.required<string>();
  readonly canEdit = input(true);
  readonly idPrefix = input("bit-inline-edit");

  /** When set, adds a `maxLength` validator. */
  readonly maxLength = input<number>();
  /** Extra validators appended to the built-in `required` and trim validators. */
  readonly validators = input<ValidatorFn[]>([]);

  /** Persists the value. Resolve `false` to keep the editor open. */
  readonly save = input.required<(value: string) => Promise<boolean>>();

  readonly editing = model(false);

  protected readonly form = new FormGroup({
    value: new FormControl("", {
      nonNullable: true,
      // trimValidator rewrites the value, so only run validation on submit.
      updateOn: "submit",
    }),
  });

  /** Tracks `value`, but also updates locally on save so the saved text shows before the consumer
   * pushes it back through `[value]`. */
  protected readonly displayValue = linkedSignal(() => this.value());

  private readonly formEvents = toSignal(this.form.controls.value.events);

  constructor() {
    // Seed the form when the editor opens, however it was opened. untracked: inputs changing
    // mid-edit must not clobber what the user typed.
    effect(() => {
      if (this.editing()) {
        untracked(() => this.prepareForm());
      }
    });

    // Close the editor if edit permission is revoked mid-edit.
    effect(() => {
      if (!this.canEdit()) {
        this.editing.set(false);
      }
    });
  }

  /** First validation error on the value control, as a `[key, value]` tuple for `bit-error`. */
  protected readonly valueError = computed<[string, unknown] | undefined>(() => {
    this.formEvents(); // recompute on value/status/touched changes
    const control = this.form.controls.value;
    if (control.valid || !control.touched || !control.errors) {
      return undefined;
    }
    return Object.entries(control.errors)[0];
  });

  protected start() {
    this.editing.set(true);
  }

  protected cancel() {
    this.editing.set(false);
  }

  private prepareForm() {
    const validators: ValidatorFn[] = [Validators.required, trimValidator];
    const maxLength = this.maxLength();
    if (maxLength != null) {
      validators.push(Validators.maxLength(maxLength));
    }
    validators.push(...this.validators());

    this.form.controls.value.setValidators(validators);
    this.form.setValue({ value: this.value() });
  }

  protected readonly submit = async () => {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    // trimValidator may rewrite the value on submit; persist the final text.
    const value = this.form.controls.value.value;
    const saved = await this.save()(value);
    if (saved) {
      this.displayValue.set(value);
      this.editing.set(false);
    }
  };
}
