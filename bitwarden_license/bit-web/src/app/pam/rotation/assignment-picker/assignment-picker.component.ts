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
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
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
  /** i18n key for the header cell. */
  readonly headerKey: string;
  /** Classes for the header cell, for width and alignment. */
  readonly headerClass?: string;
}

/** The context each assigned row's cells are rendered with. */
export interface AssignmentPickerRowContext<TRow extends AssignmentPickerRow> {
  readonly $implicit: TRow;
}

/** The i18n key for the hint under the picker, one per state the section can be in. */
export interface AssignmentPickerHints {
  readonly default: string;
  readonly noneEligible: string;
  readonly loadError: string;
  /** Optional; omitted, a blocked picker falls through to whichever other state applies. */
  readonly disabled?: string;
}

/**
 * The assign-things-of-one-kind-to-this-record card the rotation surface uses everywhere: a
 * multi-select of what is eligible, an Assign beside it, a hint carrying whichever state the
 * section is in, and a table of what is assigned with a Remove per row.
 *
 * The assigned rows' cells come from the caller as a {@link TemplateRef}.
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

  /** i18n key for the section heading. */
  readonly headingKey = input.required<string>();

  /** i18n key for the multi-select's label. */
  readonly selectLabelKey = input.required<string>();

  /** i18n key for the multi-select's placeholder; unset, the control keeps its own default. */
  readonly placeholderKey = input<string | null>(null);

  /** i18n key for the Assign button. */
  readonly assignLabelKey = input("assign");

  /**
   * i18n key for the Remove control's accessible name, taking the row's `label` as its one
   * placeholder.
   */
  readonly unassignLabelKey = input.required<string>();

  /** i18n key for the row that stands in for an empty table. */
  readonly emptyKey = input.required<string>();

  /** What can still be assigned: everything eligible the record does not already hold. */
  readonly options = input.required<SelectItemView[]>();

  /** What is assigned now, one row each. */
  readonly assignments = input.required<readonly TRow[]>();

  /** The assigned table's columns, left to right; the options column is appended for you. */
  readonly columns = input.required<readonly AssignmentPickerColumn[]>();

  /** Renders one assigned row's cells, matching {@link columns}. The `<tr>` is not yours. */
  readonly rowTemplate = input.required<TemplateRef<AssignmentPickerRowContext<TRow>>>();

  readonly hints = input.required<AssignmentPickerHints>();

  /**
   * Assigns the picked options and resolves with the ids it actually assigned. Resolving with
   * nothing empties the picker. Rejecting leaves the whole selection in place; `bitAction`
   * surfaces it.
   */
  readonly assign =
    input.required<(selected: SelectItemView[]) => Promise<readonly string[] | void>>();

  /**
   * Removes one assignment. Resolve with `false` when nothing was removed after all — a declined
   * confirmation.
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

  /** i18n key for that link. */
  readonly goToLabelKey = input<string | null>(null);

  /** Prefix for this card's element ids. */
  readonly idPrefix = input.required<string>();

  /** Options picked but not yet assigned. */
  protected readonly pendingSelection = signal<SelectItemView[]>([]);

  /** Holds every Remove, not just the clicked one. */
  protected readonly unassigning = signal(false);

  private readonly assignButton = viewChild<unknown, ElementRef<HTMLButtonElement>>(
    "assignButton",
    { read: ElementRef },
  );

  protected readonly placeholder = computed(() => {
    const key = this.placeholderKey();
    return key == null ? undefined : this.i18nService.t(key);
  });

  /**
   * The control is closed only when the record is genuinely blocked. An exhausted option list
   * leaves it open, so the dropdown can say so itself.
   */
  protected readonly canSelect = computed(() => !this.disabled());

  protected readonly canAssign = computed(
    () => !this.disabled() && this.pendingSelection().length > 0,
  );

  /**
   * The hint under the picker. An exhausted option list gets no hint of its own: the dropdown
   * opens and says it has nothing to offer.
   */
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

  protected readonly assignSelected = async (): Promise<void> => {
    const selected = this.pendingSelection();
    if (this.disabled() || selected.length === 0) {
      return;
    }

    const assigned = (await this.assign()(selected)) as readonly string[] | undefined;
    if (assigned == null) {
      this.pendingSelection.set([]);
      return;
    }
    const done = new Set(assigned.map((id) => String(id)));
    this.pendingSelection.set(selected.filter((item) => !done.has(item.id)));
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
