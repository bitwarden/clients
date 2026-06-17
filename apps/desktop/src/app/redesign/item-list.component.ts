import { ChangeDetectionStrategy, Component, input, model, output } from "@angular/core";
import { ItemSummary } from "@klappstuhl/ui-bridge";

/**
 * Middle pane: search-first item list. `query` is two-way bound; `items` are
 * already filtered by the container (shell owns the filter signal). Emits the
 * selected id.
 */
@Component({
  selector: "kls-item-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      "tw-flex tw-h-full tw-w-80 tw-shrink-0 tw-flex-col tw-bg-bg-primary",
    "[style.border-right]": "'var(--fk-glass-border)'",
  },
  template: `
    <div class="tw-p-3">
      <div class="tw-relative">
        <span
          class="tw-pointer-events-none tw-absolute tw-left-3 tw-top-1/2 tw--translate-y-1/2 tw-text-fg-body-subtle"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
            <path d="m20 20-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Search vault…"
          style="transition: border-color var(--fk-dur-fast) var(--fk-ease), box-shadow var(--fk-dur-fast) var(--fk-ease)"
          class="tw-w-full tw-rounded-[var(--fk-radius-md)] tw-border tw-border-border-base tw-bg-bg-secondary tw-py-2.5 tw-pl-9 tw-pr-3 tw-text-sm tw-text-fg-body tw-placeholder-fg-body-subtle focus-visible:tw-border-border-focus focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      </div>
    </div>

    <div class="tw-flex-1 tw-overflow-y-auto tw-px-2 tw-pb-2">
      @for (item of items(); track item.id) {
        <button
          type="button"
          class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-md)] tw-p-2.5 tw-text-left tw-transition-all focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
          [style.transition-duration]="'var(--fk-dur-fast)'"
          [style.transition-timing-function]="'var(--fk-ease)'"
          [style.background-color]="item.id === selectedId() ? 'var(--fk-selected-bg)' : 'transparent'"
          [style.box-shadow]="item.id === selectedId() ? 'var(--fk-elev-glow)' : 'none'"
          (mouseenter)="$any($event.currentTarget).style.backgroundColor = item.id !== selectedId() ? 'var(--fk-hover-bg)' : 'var(--fk-selected-bg)'"
          (mouseleave)="$any($event.currentTarget).style.backgroundColor = item.id === selectedId() ? 'var(--fk-selected-bg)' : 'transparent'"
          (click)="select.emit(item.id)"
        >
          <span
            class="tw-flex tw-size-9 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-[var(--fk-radius-lg)] tw-text-sm tw-font-semibold tw-text-fg-brand"
            style="background-color: var(--fk-card-bg); backdrop-filter: blur(var(--fk-blur-subtle)); -webkit-backdrop-filter: blur(var(--fk-blur-subtle))"
          >
            {{ initial(item.title) }}
          </span>
          <span class="tw-min-w-0 tw-flex-1">
            <span class="tw-flex tw-items-center tw-gap-1.5">
              <span class="tw-truncate tw-text-sm tw-font-medium tw-text-fg-heading">{{
                item.title
              }}</span>
              @if (item.favorite) {
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="tw-shrink-0 tw-text-fg-warning"
                  aria-label="Favorite"
                >
                  <path
                    d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19l1-5.8L3.5 9.2l5.9-.9L12 3Z"
                  />
                </svg>
              }
            </span>
            @if (item.subtitle) {
              <span class="tw-block tw-truncate tw-text-[12px] tw-text-fg-body-subtle">{{
                item.subtitle
              }}</span>
            }
          </span>
          @if (item.hasTotp) {
            <span class="tw-shrink-0 tw-text-[10px] tw-font-semibold tw-text-fg-brand">TOTP</span>
          }
        </button>
      } @empty {
        <div class="tw-px-3 tw-py-8 tw-text-center tw-text-sm tw-text-fg-body-subtle">
          No items match your search.
        </div>
      }
    </div>
  `,
})
export class KlsItemListComponent {
  readonly items = input.required<ItemSummary[]>();
  readonly selectedId = input<string | undefined>(undefined);
  readonly query = model<string>("");
  readonly select = output<string>();

  protected initial(title: string): string {
    return title.trim().charAt(0).toUpperCase() || "?";
  }
}
