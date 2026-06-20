import { ChangeDetectionStrategy, Component, input, model } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AsyncActionsModule,
  BitValidators,
  IconButtonModule,
  InputModule,
} from "@bitwarden/components";

import { SM_NAME_MAX_LENGTH } from "./sm-constants";

// Non-breaking space: app-header falls back to the route title when [title] is empty.
const TITLE_PLACEHOLDER = "\u00A0";

/** Inline rename affordance for an `app-header` title; lives in the `title-suffix` slot. */
@Component({
  selector: "sm-inline-rename",
  templateUrl: "./inline-rename.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-contents",
  },
  imports: [JslibModule, ReactiveFormsModule, AsyncActionsModule, IconButtonModule, InputModule],
})
export class InlineRenameComponent {
  readonly name = input.required<string>();
  /** aria-label for the text field. */
  readonly label = input.required<string>();
  /** aria-label for the pencil button. */
  readonly editLabel = input.required<string>();
  readonly canEdit = input(true);
  readonly idPrefix = input("inline-rename");

  /** Persists the name. Resolve `false` to keep the editor open. */
  readonly save = input.required<(name: string) => Promise<boolean>>();

  readonly editing = model(false);

  /** Host binds this to app-header's `[title]` while editing. */
  readonly titlePlaceholder = TITLE_PLACEHOLDER;

  protected readonly form = new FormGroup({
    name: new FormControl("", {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(SM_NAME_MAX_LENGTH),
        BitValidators.trimValidator,
      ],
      // trimValidator rewrites the value, so only run it on submit.
      updateOn: "submit",
    }),
  });

  protected start() {
    this.form.setValue({ name: this.name() });
    this.editing.set(true);
  }

  protected cancel() {
    this.editing.set(false);
  }

  protected readonly submit = async () => {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    const saved = await this.save()(this.form.controls.name.value);
    if (saved) {
      this.editing.set(false);
    }
  };
}
