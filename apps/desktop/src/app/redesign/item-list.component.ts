import { ChangeDetectionStrategy, Component, input, model, output } from "@angular/core";
import { CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf } from "@angular/cdk/scrolling";
import { ItemSummary } from "@klappstuhl/ui-bridge";

@Component({
  selector: "kls-item-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf],
  host: {
    class:
      "tw-flex tw-h-full tw-w-[320px] tw-shrink-0 tw-flex-col tw-bg-bg-primary",
    "[style.border-right]": "'var(--fk-glass-border)'",
  },
  template: `
    <div class="tw-p-3 tw-pb-2">
      <div class="tw-relative">
        <span
          class="tw-pointer-events-none tw-absolute tw-left-3.5 tw-top-1/2 tw--translate-y-1/2 tw-text-fg-body-subtle"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.75" />
            <path d="m20 20-3-3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
          </svg>
        </span>
        <input
          type="search"
          placeholder="Search vault…"
          style="transition: all var(--fk-dur-fast) var(--fk-ease); background-color: var(--fk-card-bg); backdrop-filter: blur(var(--fk-blur-subtle)); -webkit-backdrop-filter: blur(var(--fk-blur-subtle)); border: var(--fk-glass-border); box-shadow: var(--fk-glass-highlight)"
          class="tw-w-full tw-rounded-[var(--fk-radius-full)] tw-py-2.5 tw-pl-10 tw-pr-4 tw-text-[13px] tw-text-fg-body tw-placeholder-fg-body-subtle focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      </div>
    </div>

    @if (items().length > 0) {
      <cdk-virtual-scroll-viewport
        [itemSize]="56"
        class="tw-flex-1 tw-px-2 tw-pb-2"
      >
        <div
          *cdkVirtualFor="let item of items(); trackBy: trackById"
          class="tw-py-0.5"
        >
          <button
            type="button"
            class="tw-group tw-relative tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-lg)] tw-p-2.5 tw-text-left focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
            [style.transition]="'all var(--fk-dur-fast) var(--fk-ease)'"
            [style.background-color]="item.id === selectedId() ? 'var(--fk-card-bg)' : 'transparent'"
            [style.border]="item.id === selectedId() ? 'var(--fk-glass-border)' : '1px solid transparent'"
            [style.box-shadow]="item.id === selectedId() ? 'var(--fk-glass-highlight), var(--fk-elev-xs)' : 'none'"
            [style.backdrop-filter]="item.id === selectedId() ? 'blur(var(--fk-blur-subtle))' : 'none'"
            [style.-webkit-backdrop-filter]="item.id === selectedId() ? 'blur(var(--fk-blur-subtle))' : 'none'"
            (mouseenter)="onItemHover($any($event.currentTarget), item.id !== selectedId())"
            (mouseleave)="onItemLeave($any($event.currentTarget), item.id === selectedId())"
            (click)="select.emit(item.id)"
          >
            <span
              class="tw-flex tw-size-10 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-[var(--fk-radius-lg)] tw-text-sm tw-font-semibold"
              [class.tw-text-fg-brand]="item.id === selectedId()"
              [class.tw-text-fg-body-subtle]="item.id !== selectedId()"
              style="background-color: var(--fk-card-bg); border: var(--fk-glass-border); box-shadow: var(--fk-glass-highlight); backdrop-filter: blur(var(--fk-blur-subtle)); -webkit-backdrop-filter: blur(var(--fk-blur-subtle))"
            >
              {{ initial(item.title) }}
            </span>
            <span class="tw-min-w-0 tw-flex-1">
              <span class="tw-flex tw-items-center tw-gap-1.5">
                <span class="tw-truncate tw-text-[13px] tw-font-medium tw-text-fg-heading">{{
                  item.title
                }}</span>
                @if (item.favorite) {
                  <svg
                    width="11"
                    height="11"
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

            <!-- Quick-copy buttons (visible on hover) -->
            <span
              class="tw-absolute tw-right-2 tw-top-1/2 tw-flex tw--translate-y-1/2 tw-items-center tw-gap-1 tw-opacity-0 tw-transition-opacity group-hover:tw-opacity-100"
              [style.transition-duration]="'var(--fk-dur-fast)'"
            >
              @if (item.subtitle) {
                <button
                  type="button"
                  class="tw-rounded-[var(--fk-radius-full)] tw-p-1.5 tw-text-fg-body-subtle hover:tw-text-fg-brand"
                  style="transition: all var(--fk-dur-fast) var(--fk-ease-spring); background-color: var(--fk-card-bg); border: var(--fk-glass-border)"
                  title="Copy username"
                  (click)="onQuickCopy($event, item.subtitle!)"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.75" />
                    <path d="M5 20a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                  </svg>
                </button>
              }
              @if (item.hasTotp) {
                <button
                  type="button"
                  class="tw-rounded-[var(--fk-radius-full)] tw-p-1.5 tw-text-fg-body-subtle hover:tw-text-fg-brand"
                  style="transition: all var(--fk-dur-fast) var(--fk-ease-spring); background-color: var(--fk-card-bg); border: var(--fk-glass-border)"
                  title="Copy TOTP"
                  (click)="quickCopyTotp.emit(item.id); $event.stopPropagation()"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75" />
                    <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                  </svg>
                </button>
              }
            </span>

            @if (item.hasTotp) {
              <span
                class="tw-shrink-0 tw-rounded-[var(--fk-radius-full)] tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-text-fg-brand group-hover:tw-hidden"
                style="background-color: var(--fk-selected-bg)"
              >TOTP</span>
            }
          </button>
        </div>
      </cdk-virtual-scroll-viewport>
    } @else {
      <div class="tw-flex tw-flex-1 tw-items-center tw-justify-center tw-px-3 tw-py-12 tw-text-center tw-text-[13px] tw-text-fg-body-subtle">
        No items match your search.
      </div>
    }
  `,
  styles: [`
    cdk-virtual-scroll-viewport {
      /* CDK viewport needs an explicit height; flex-1 + overflow gives it. */
      contain: strict;
    }
  `],
})
export class KlsItemListComponent {
  readonly items = input.required<readonly ItemSummary[]>();
  readonly selectedId = input<string | undefined>(undefined);
  readonly query = model<string>("");
  readonly select = output<string>();
  readonly quickCopyTotp = output<string>();

  protected trackById(_: number, item: ItemSummary): string {
    return item.id;
  }

  protected initial(title: string): string {
    return title.trim().charAt(0).toUpperCase() || "?";
  }

  protected onQuickCopy(event: Event, value: string): void {
    event.stopPropagation();
    void navigator.clipboard?.writeText(value);
  }

  protected onItemHover(el: HTMLElement, isInactive: boolean): void {
    if (isInactive) {
      el.style.backgroundColor = "var(--fk-hover-bg)";
      el.style.border = "var(--fk-glass-border)";
      el.style.transform = "translateX(2px)";
    }
  }

  protected onItemLeave(el: HTMLElement, isActive: boolean): void {
    if (!isActive) {
      el.style.backgroundColor = "transparent";
      el.style.border = "1px solid transparent";
      el.style.transform = "translateX(0)";
    }
  }
}
