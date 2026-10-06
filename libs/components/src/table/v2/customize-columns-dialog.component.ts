import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormRecord, ReactiveFormsModule } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonModule } from "../../button";
import { DIALOG_DATA, DialogModule } from "../../dialog";
import { FormControlModule } from "../../form-control";
import { SwitchComponent } from "../../switch";
import { focusAfterRender } from "../../utils/focus-after-render";

import { RemovableColumn } from "./column";

/** Data passed to {@link CustomizeColumnsDialogComponent} when the toolbar opens it. */
export interface CustomizeColumnsDialogParams {
  /** The togglable columns, in display order. */
  readonly columns: readonly RemovableColumn[];
  /** The names hidden when the dialog opens. */
  readonly hidden: ReadonlySet<string>;
  /** Shows or hides one column. Idempotent. */
  readonly setHidden: (name: string, hidden: boolean) => void;
  /** Restores the declared column set. */
  readonly reset: () => void;
}

/**
 * Picks which of a `bit-table-v2`'s columns are shown. Opened by `bit-table-toolbar`.
 *
 * Switches apply immediately, so there's no submit or cancel; Done and X just dismiss.
 */
@Component({
  selector: "bit-customize-columns-dialog",
  templateUrl: "./customize-columns-dialog.component.html",
  imports: [
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    FormControlModule,
    SwitchComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomizeColumnsDialogComponent {
  private readonly injector = inject(Injector);
  private readonly params = inject<CustomizeColumnsDialogParams>(DIALOG_DATA);

  private readonly doneButtonEl = viewChild("doneButton", { read: ElementRef<HTMLElement> });

  protected readonly columns = this.params.columns;

  /** One control per column name, `true` when the column is shown. */
  protected readonly form = new FormRecord(
    Object.fromEntries(
      this.columns.map((col) => [
        col.name,
        new FormControl(!this.params.hidden.has(col.name), { nonNullable: true }),
      ]),
    ),
  );

  /** Whether any column is switched off. Drives the Reset control, offered only then. */
  protected readonly modified = signal(this.anyHidden());

  constructor() {
    for (const [name, control] of Object.entries(this.form.controls)) {
      control.valueChanges.pipe(takeUntilDestroyed()).subscribe((shown) => {
        this.params.setHidden(name, !shown);
        this.modified.set(this.anyHidden());
      });
    }
  }

  private anyHidden(): boolean {
    return Object.values(this.form.getRawValue()).some((shown) => !shown);
  }

  /** Restores the declared column set, re-syncing the switches without re-firing toggles. */
  protected resetToDefault(): void {
    this.params.reset();
    this.form.patchValue(
      Object.fromEntries(Object.keys(this.form.controls).map((name) => [name, true])),
      {
        emitEvent: false,
      },
    );
    this.modified.set(false);
    // Resetting clears `modified`, which removes this very button, so hand focus to Done
    // rather than letting it fall to the body.
    focusAfterRender(this.injector, () => this.doneButtonEl()?.nativeElement);
  }
}
