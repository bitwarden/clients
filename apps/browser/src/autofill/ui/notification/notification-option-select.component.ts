import { ChangeDetectionStrategy, Component, computed, input, model } from "@angular/core";

import { BitwardenIcon, ButtonModule, IconComponent, MenuModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type NotificationSelectOption = {
  value: string;
  text: string;
  icon?: BitwardenIcon;
  default?: boolean;
};

@Component({
  selector: "autofill-notification-option-select",
  imports: [ButtonModule, I18nPipe, IconComponent, MenuModule],
  host: { class: "tw-block tw-min-w-0" },
  template: `
    <button
      [id]="'notification-option-select_button_' + name()"
      type="button"
      bitButton
      buttonType="secondary"
      size="small"
      class="tw-w-full tw-max-w-full"
      [startIcon]="selected()?.icon"
      [endIcon]="trigger.isOpen() ? 'bwi-angle-up' : 'bwi-angle-down'"
      [title]="selected()?.text ?? ''"
      [attr.data-testid]="name() + '-option-selection'"
      [bitMenuTriggerFor]="menu"
      #trigger="menuTrigger"
    >
      <span class="tw-truncate">{{ selected()?.text }}</span>
    </button>
    <bit-menu #menu [ariaLabel]="label()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          bitMenuItem
          [attr.data-testid]="name() + '-option-item'"
          [attr.aria-label]="
            label() ? ('selectItemAriaLabel' | i18n: label() : option.text) : option.text
          "
          (click)="value.set(option.value)"
        >
          @if (option.icon) {
            <bit-icon slot="start" [name]="option.icon" />
          }
          {{ option.text }}
        </button>
      }
    </bit-menu>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationOptionSelectComponent {
  /** Identifies the select in test ids, e.g. `"folder"`. */
  readonly name = input.required<string>();
  readonly label = input<string>();
  readonly options = input<NotificationSelectOption[]>([]);
  readonly value = model<string>();

  protected readonly selected = computed(() => {
    const options = this.options();
    return (
      options.find((o) => o.value === this.value()) ?? options.find((o) => o.default) ?? options[0]
    );
  });
}
