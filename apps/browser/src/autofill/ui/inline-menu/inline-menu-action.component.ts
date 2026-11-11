import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { BitwardenIcon, IconComponent, ItemModule } from "@bitwarden/components";

/**
 * The main content of an action row, e.g. "Unlock account" or "New login". The list renders the
 * surrounding `bit-item` so compact mode can join it to neighboring rows.
 */
@Component({
  selector: "autofill-inline-menu-action",
  imports: [IconComponent, ItemModule],
  host: { class: "tw-flex tw-min-w-0 tw-flex-1" },
  template: `
    <button
      [id]="'inline-menu-action_button_' + name()"
      type="button"
      bit-item-content
      [attr.data-testid]="'inline-menu-' + name() + '-button'"
      [attr.aria-label]="ariaLabel()"
      (click)="action.emit()"
    >
      <bit-icon slot="start" [name]="icon()" class="tw-text-fg-brand" />
      <span class="tw-font-semibold tw-text-fg-brand">{{ text() }}</span>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineMenuActionComponent {
  /** Identifies the action in element and test ids, e.g. `"unlock"`. */
  readonly name = input.required<string>();
  readonly icon = input.required<BitwardenIcon>();
  readonly text = input.required<string>();
  readonly ariaLabel = input<string>();

  readonly action = output<void>();
}
