import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { BitwardenIcon, IconComponent, ItemModule } from "@bitwarden/components";

/** A full-width action row in the inline menu list, e.g. "Unlock account" or "New login". */
@Component({
  selector: "autofill-inline-menu-action",
  imports: [IconComponent, ItemModule],
  template: `
    <bit-item>
      <button
        [id]="'inline-menu-action_button_' + name()"
        type="button"
        bit-item-content
        [attr.data-testid]="'inline-menu-' + name() + '-button'"
        [attr.aria-label]="ariaLabel()"
        (click)="action.emit()"
      >
        <bit-icon slot="start" [name]="icon()" class="tw-text-fg-brand" />
        <span class="tw-font-medium tw-text-fg-brand">{{ text() }}</span>
      </button>
    </bit-item>
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
