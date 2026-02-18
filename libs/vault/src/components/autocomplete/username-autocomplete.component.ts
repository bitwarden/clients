import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core";

@Component({
  selector: "vault-username-autocomplete",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      *ngIf="visible() && suggestions().length > 0"
      class="tw-absolute tw-inset-x-0 tw-top-full tw-z-50 tw-mt-0.5"
    >
      <div
        class="tw-flex tw-flex-col tw-rounded-lg tw-border tw-border-solid tw-border-secondary-300 tw-bg-background tw-shadow-lg tw-py-1 tw-max-h-48 tw-overflow-y-auto"
        role="listbox"
        [attr.id]="listId()"
      >
        <!-- Header -->
        <div
          class="tw-px-3 tw-py-1 tw-text-xs tw-font-semibold tw-text-muted tw-uppercase tw-tracking-wide"
          role="presentation"
        >
          {{ headerText() }}
        </div>

        <!-- Suggestions -->
        <div
          *ngFor="let username of suggestions(); let i = index"
          class="tw-px-3 tw-py-2 tw-cursor-pointer tw-text-sm tw-transition-colors hover:tw-bg-primary-100"
          [class.tw-bg-primary-100]="displayIndex() === i"
          (mousedown)="selectItem($event, username)"
          (mouseenter)="hoverIndex.set(i)"
          role="option"
          tabindex="-1"
          [attr.aria-selected]="displayIndex() === i"
          [attr.id]="optionId(i)"
          (keydown.enter)="selectItem($event, username)"
          (keydown.space)="selectItem($event, username)"
        >
          {{ username }}
        </div>
      </div>
    </div>
  `,
})
export class UsernameAutocompleteComponent {
  readonly suggestions = input<string[]>([]);
  readonly visible = input(false);
  readonly activeIndex = input<number>(-1);
  readonly idPrefix = input("username-autocomplete");
  readonly headerText = input("Recent usernames");
  selected = output<string>();

  readonly hoverIndex = signal(-1);
  readonly displayIndex = computed(() =>
    this.activeIndex() >= 0 ? this.activeIndex() : this.hoverIndex(),
  );

  readonly listId = computed(() => `${this.idPrefix()}-listbox`);
  optionId = (index: number) => `${this.idPrefix()}-option-${index}`;

  selectItem(event: MouseEvent | KeyboardEvent, username: string) {
    event.preventDefault();
    this.selected.emit(username);
    this.hoverIndex.set(-1);
  }
}
