import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  BitCellComponent,
  BitHeaderCellComponent,
  BitHeaderRowComponent,
  BitRowComponent,
  BitTableV2Component,
  ButtonModule,
  CardComponent,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectItemView,
  TableModule,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** The least an assigned row has to carry. */
export interface AssignmentPickerRow {
  readonly id: string;
  readonly label: string;
}

/** One column of the assigned-rows table, other than the trailing options column. */
export interface AssignmentPickerColumn {
  readonly headerKey: string;
  readonly headerClass?: string;
}

export interface AssignmentPickerRowContext<TRow extends AssignmentPickerRow> {
  readonly $implicit: TRow;
  /**
   * Set under `bit-table-v2`, whose cells must be `<bit-cell>`, since a `<td>` there has no
   * `<table>` ancestor and no cell role. Remove when the VFO1 flag is removed.
   */
  readonly vfo1?: boolean;
}

/** The i18n key for the hint under the picker, one per state the section can be in. */
export interface AssignmentPickerHints {
  readonly default: string;
  readonly noneEligible: string;
  readonly loadError: string;
  /** Without it, a blocked picker shows whichever other state applies. */
  readonly disabled?: string;
}

/**
 * The rotation pages' assignment card: a multi-select of eligible options with an Assign button,
 * and a table of current assignments with a Remove per row. The caller renders each row's cells
 * as a {@link TemplateRef}.
 */
@Component({
  selector: "pam-assignment-picker",
  templateUrl: "./assignment-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    AsyncActionsModule,
    BitCellComponent,
    BitHeaderCellComponent,
    BitHeaderRowComponent,
    BitRowComponent,
    BitTableV2Component,
    ButtonModule,
    CardComponent,
    FormFieldModule,
    IconButtonModule,
    LinkModule,
    SectionComponent,
    SectionHeaderComponent,
    TableModule,
    TooltipDirective,
    TypographyModule,
    I18nPipe,
  ],
})
export class AssignmentPickerComponent<TRow extends AssignmentPickerRow> {
  private readonly i18nService = inject(I18nService);
  // Optional because the host pages' specs render this card without providing one.
  private readonly configService = inject(ConfigService, { optional: true });

  // remove when VFO1 flag is removed
  protected readonly vfo1Enabled = toSignal(
    this.configService?.getFeatureFlag$(FeatureFlag.VFO1Foundation) ?? of(false),
    { initialValue: false },
  );

  readonly headingKey = input.required<string>();

  readonly selectLabelKey = input.required<string>();

  /** Unset, the control keeps its own placeholder. */
  readonly placeholderKey = input<string | null>(null);

  readonly assignLabelKey = input("assign");

  /** The Remove control's accessible name, with the row's `label` as its placeholder. */
  readonly unassignLabelKey = input.required<string>();

  /** i18n key for the row shown when the table is empty. */
  readonly emptyKey = input.required<string>();

  /** What can still be assigned: everything eligible the record does not already hold. */
  readonly options = input.required<SelectItemView[]>();

  readonly assignments = input.required<readonly TRow[]>();

  /** Left to right; the options column is appended. */
  readonly columns = input.required<readonly AssignmentPickerColumn[]>();

  /** Renders one row's cells, matching {@link columns}; the component supplies the row element. */
  readonly rowTemplate = input.required<TemplateRef<AssignmentPickerRowContext<TRow>>>();

  readonly hints = input.required<AssignmentPickerHints>();

  /**
   * Resolves with the ids that were assigned, so a partial success leaves the rest picked for a
   * retry; resolving with nothing clears what was sent. A rejection keeps the selection, and
   * `bitAction` surfaces it.
   */
  readonly assign =
    input.required<(selected: SelectItemView[]) => Promise<readonly string[] | void>>();

  /**
   * Resolve with `false` when nothing was removed, such as a declined confirmation. Nothing here
   * catches a rejection, so the caller must toast a failure and resolve `false`, or focus moves to
   * Assign as though the row had gone.
   */
  readonly unassign = input.required<(row: TRow) => Promise<boolean | void>>();

  /** The record cannot take assignments at all right now, such as a deactivated connector. */
  readonly disabled = input(false);

  /** i18n key explaining {@link disabled} on the Assign button. */
  readonly disabledTooltipKey = input<string | null>(null);

  /** The eligible list could not be read. */
  readonly loadError = input(false);

  /** Nothing is eligible at all, as opposed to everything eligible being assigned already. */
  readonly noneEligible = input(false);

  /** Where the escape hatch under {@link noneEligible} goes; unset, no link is offered. */
  readonly goToRoute = input<unknown[] | null>(null);

  readonly goToLabelKey = input<string | null>(null);

  readonly idPrefix = input.required<string>();

  /** Options picked but not yet assigned. */
  protected readonly pendingSelection = signal<SelectItemView[]>([]);

  /** Holds every Remove, not only the clicked one. */
  protected readonly unassigning = signal(false);

  private readonly assignButton = viewChild<unknown, ElementRef<HTMLButtonElement>>(
    "assignButton",
    { read: ElementRef },
  );

  protected readonly placeholder = computed(() => {
    const key = this.placeholderKey();
    return key == null ? undefined : this.i18nService.t(key);
  });

  /** An exhausted option list leaves the control enabled, so the dropdown can say so itself. */
  protected readonly canSelect = computed(() => !this.disabled());

  /**
   * Known gap: Escape with the dropdown open empties `bit-multi-select`'s displayed selection
   * without notifying anyone, so a confirmed pick keeps Assign armed over an empty field. The fix
   * belongs in the shared control.
   */
  protected readonly canAssign = computed(
    () => !this.disabled() && this.pendingSelection().length > 0,
  );

  /** An exhausted option list gets no hint, since the dropdown says it has nothing to offer. */
  protected readonly hintKey = computed(() => {
    const hints = this.hints();
    if (this.disabled() && hints.disabled != null) {
      return hints.disabled;
    }
    if (this.loadError()) {
      return hints.loadError;
    }
    if (this.noneEligible()) {
      return hints.noneEligible;
    }
    return hints.default;
  });

  /** The escape hatch under {@link noneEligible}. Withheld while {@link loadError} stands. */
  protected readonly showGoToLink = computed(
    () =>
      this.noneEligible() &&
      !this.loadError() &&
      this.goToRoute() != null &&
      this.goToLabelKey() != null,
  );

  protected readonly assignTooltip = computed(() => {
    const key = this.disabledTooltipKey();
    return this.disabled() && key != null ? this.i18nService.t(key) : "";
  });

  /** The caller's columns plus the options column, for the empty row's colspan. */
  protected readonly columnCount = computed(() => this.columns().length + 1);

  /**
   * Additions arrive through `onItemsConfirmed`; this handles removals. `[ngModel]` writes this
   * signal back into the control, so it keeps the same array when nothing was removed and
   * otherwise adopts the control's whole selection.
   */
  protected readonly onSelectionChanged = (items: SelectItemView[] | null): void => {
    const selected = items ?? [];
    const kept = new Set(selected.map((item) => item.id));
    this.pendingSelection.update((current) =>
      current.every((item) => kept.has(item.id)) ? current : selected,
    );
  };

  protected readonly assignSelected = async (): Promise<void> => {
    const selected = this.pendingSelection();
    if (this.disabled() || selected.length === 0) {
      return;
    }

    const assigned = (await this.assign()(selected)) as readonly string[] | undefined;
    const done = new Set<string>(
      assigned == null ? selected.map((item) => item.id) : assigned.map((id) => String(id)),
    );
    this.pendingSelection.update((current) => current.filter((item) => !done.has(item.id)));
  };

  protected readonly removeAssignment = async (row: TRow): Promise<void> => {
    if (this.unassigning()) {
      return;
    }
    this.unassigning.set(true);
    try {
      const removed = await this.unassign()(row);
      if (removed !== false) {
        this.assignButton()?.nativeElement.focus();
      }
    } finally {
      this.unassigning.set(false);
    }
  };
}
