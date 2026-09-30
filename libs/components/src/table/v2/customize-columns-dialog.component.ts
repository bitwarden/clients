import { LiveAnnouncer } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  Signal,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { ButtonModule } from "../../button";
import { DIALOG_DATA, DialogModule } from "../../dialog";
import { FormControlModule } from "../../form-control";
import { SwitchComponent } from "../../switch";
import { focusAfterRender } from "../../utils/focus-after-render";

import { RemovableColumn } from "./column";

/** Data passed to {@link CustomizeColumnsDialogComponent} when the toolbar opens it. */
export interface CustomizeColumnsDialogParams {
  /** The togglable columns, in display order. Excludes the primary column. */
  readonly columns: readonly RemovableColumn[];
  /** The currently hidden names — live, so the switches track the table. */
  readonly hidden: Signal<ReadonlySet<string>>;
  /** Shows or hides one column. Idempotent. */
  readonly setHidden: (name: string, hidden: boolean) => void;
  /** Restores the declared column set. */
  readonly reset: () => void;
}

/**
 * Picks which of a `bit-table-v2`'s columns are shown. Opened by `bit-table-toolbar`.
 *
 * Each switch applies immediately — the table re-lays out behind the scrim — so there is
 * no submit step and no cancel: Done and the dialog's X both just dismiss.
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
  private readonly liveAnnouncer = inject(LiveAnnouncer);
  private readonly i18nService = inject(I18nService);
  private readonly params = inject<CustomizeColumnsDialogParams>(DIALOG_DATA);

  private readonly doneButtonEl = viewChild("doneButton", { read: ElementRef<HTMLElement> });

  protected readonly columns = this.params.columns;

  /** One control per column, `true` when the column is shown. */
  protected readonly form = new FormGroup(
    Object.fromEntries(
      this.columns.map((col) => [col.name, new FormControl(!this.params.hidden().has(col.name))]),
    ),
  );

  /**
   * The last value forwarded to the table. Changes diff against this rather than the
   * table's hidden set, which is written asynchronously and so can still be stale.
   */
  private readonly shown = new Map(
    this.columns.map((col) => [col.name, !this.params.hidden().has(col.name)]),
  );

  /** Whether any column is switched off. Drives the Reset control, offered only then. */
  protected readonly modified = signal(this.anyHidden());

  constructor() {
    // Switches act immediately, so each change writes straight through with no submit.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      for (const col of this.columns) {
        const shown = value[col.name] === true;
        if (shown === this.shown.get(col.name)) {
          continue;
        }
        this.shown.set(col.name, shown);
        this.params.setHidden(col.name, !shown);
        void this.liveAnnouncer.announce(
          this.i18nService.t(shown ? "columnShown" : "columnHidden", col.label),
        );
      }
      this.modified.set(this.anyHidden());
    });
  }

  private anyHidden(): boolean {
    return [...this.shown.values()].some((shown) => !shown);
  }

  /** Restores the declared column set, re-syncing the switches without re-firing toggles. */
  protected resetToDefault(): void {
    this.params.reset();
    this.columns.forEach((col) => this.shown.set(col.name, true));
    this.modified.set(false);
    this.form.patchValue(Object.fromEntries(this.columns.map((col) => [col.name, true])), {
      emitEvent: false,
    });
    // Resetting clears `modified`, which removes this very button, so hand focus to Done
    // rather than letting it fall to the body.
    focusAfterRender(this.injector, () => this.doneButtonEl()?.nativeElement);
  }
}
