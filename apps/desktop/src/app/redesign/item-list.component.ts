import { ChangeDetectionStrategy, Component, inject, input, model, output, signal } from "@angular/core";
import {
  CdkVirtualScrollViewport,
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
} from "@angular/cdk/scrolling";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ItemSummary } from "@klappstuhl/ui-bridge";

@Component({
  selector: "kls-item-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf],
  host: {
    class: "tw-flex tw-h-full tw-w-[340px] tw-shrink-0 tw-flex-col tw-bg-bg-primary",
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
          [placeholder]="i18n.t('searchVault') || 'Search vault'"
          style="transition: all var(--fk-dur-fast) var(--fk-ease); background-color: var(--fk-card-bg); backdrop-filter: blur(var(--fk-blur-subtle)); -webkit-backdrop-filter: blur(var(--fk-blur-subtle)); border: var(--fk-glass-border); box-shadow: var(--fk-glass-highlight)"
          class="tw-w-full tw-rounded-[var(--fk-radius-full)] tw-py-2.5 tw-pl-10 tw-pr-4 tw-text-[13px] tw-text-fg-body tw-placeholder-fg-body-subtle focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
          [value]="query()"
          (input)="query.set($any($event.target).value)"
        />
      </div>
    </div>

    @if (items().length > 0) {
      <cdk-virtual-scroll-viewport [itemSize]="64" class="tw-flex-1 tw-px-3 tw-pb-2">
        <div *cdkVirtualFor="let item of items(); trackBy: trackById" class="tw-py-1">
          <button
            type="button"
            class="tw-group tw-relative tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-lg)] tw-p-3 tw-text-left focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
            [style.transition]="'all var(--fk-dur-fast) var(--fk-ease)'"
            [style.background-color]="
              item.id === selectedId() ? 'var(--fk-card-bg)' : 'transparent'
            "
            [style.border]="
              item.id === selectedId() ? 'var(--fk-glass-border)' : '1px solid transparent'
            "
            [style.box-shadow]="
              item.id === selectedId() ? 'var(--fk-glass-highlight), var(--fk-elev-xs)' : 'none'
            "
            (mouseenter)="onItemHover($any($event.currentTarget), item.id !== selectedId())"
            (mouseleave)="onItemLeave($any($event.currentTarget), item.id === selectedId())"
            (click)="select.emit(item.id)"
          >
            <!-- Icon/Favicon -->
            <span
              class="tw-flex tw-size-9 tw-shrink-0 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-[var(--fk-radius-md)]"
              style="background-color: var(--fk-card-bg); border: var(--fk-glass-border)"
            >
              @if (item.iconUrl && !failedIcons()[item.id]) {
                <img
                  [src]="item.iconUrl"
                  class="tw-size-5 tw-object-contain"
                  (error)="onIconError(item.id)"
                  loading="lazy"
                  alt=""
                />
              } @else {
                <span
                  class="tw-text-[12px] tw-font-semibold"
                  [class.tw-text-fg-brand]="item.id === selectedId()"
                  [class.tw-text-fg-body-subtle]="item.id !== selectedId()"
                >{{ initial(item.title) }}</span>
              }
            </span>

            <span class="tw-min-w-0 tw-flex-1">
              <span class="tw-flex tw-items-center tw-gap-1.5">
                <span class="tw-truncate tw-text-[13px] tw-font-medium tw-text-fg-heading">{{
                  item.title
                }}</span>
                @if (item.favorite) {
                  <svg
                    width="10"
                    height="10"
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
                <span class="tw-block tw-truncate tw-text-[11px] tw-text-fg-body-subtle">{{
                  item.subtitle
                }}</span>
              }
            </span>

            <!-- Quick-copy buttons (visible on hover) -->
            <span
              class="tw-absolute tw-right-2.5 tw-top-1/2 tw-flex tw--translate-y-1/2 tw-items-center tw-gap-1 tw-opacity-0 tw-transition-opacity group-hover:tw-opacity-100"
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
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.75" />
                    <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
                  </svg>
                </button>
              }
            </span>

            <!-- Kind badge (non-hover) -->
            @if (item.hasTotp) {
              <span
                class="tw-shrink-0 tw-rounded-[var(--fk-radius-full)] tw-px-1.5 tw-py-0.5 tw-text-[9px] tw-font-semibold tw-uppercase tw-text-fg-brand group-hover:tw-hidden"
                style="background-color: var(--fk-selected-bg)"
                >TOTP</span
              >
            } @else if (item.kind !== "login") {
              <span
                class="tw-shrink-0 tw-rounded-[var(--fk-radius-full)] tw-px-1.5 tw-py-0.5 tw-text-[9px] tw-font-semibold tw-uppercase group-hover:tw-hidden"
                [style.color]="kindColor(item.kind)"
                [style.background-color]="kindBg(item.kind)"
              >{{ kindLabel(item.kind) }}</span>
            }
          </button>
        </div>
      </cdk-virtual-scroll-viewport>
    } @else {
      <div
        class="tw-flex tw-flex-1 tw-items-center tw-justify-center tw-px-3 tw-py-12 tw-text-center tw-text-[13px] tw-text-fg-body-subtle"
      >
        {{ i18n.t('noItemsInList') || 'No items found.' }}
      </div>
    }
  `,
  styles: [
    `
      cdk-virtual-scroll-viewport {
        contain: strict;
      }
    `,
  ],
})
export class KlsItemListComponent {
  protected readonly i18n = inject(I18nService);
  readonly items = input.required<readonly ItemSummary[]>();
  readonly selectedId = input<string | undefined>(undefined);
  readonly query = model<string>("");
  readonly select = output<string>();
  readonly quickCopyTotp = output<string>();

  protected readonly failedIcons = signal<Record<string, boolean>>({});

  protected trackById(_: number, item: ItemSummary): string {
    return item.id;
  }

  protected initial(title: string): string {
    return title.charAt(0).toUpperCase();
  }

  protected onIconError(id: string): void {
    this.failedIcons.update((icons) => ({ ...icons, [id]: true }));
  }

  protected onItemHover(el: HTMLElement, isInactive: boolean): void {
    if (isInactive) {
      el.style.backgroundColor = "var(--fk-hover-bg)";
      el.style.border = "var(--fk-glass-border)";
    }
  }

  protected onItemLeave(el: HTMLElement, isActive: boolean): void {
    if (!isActive) {
      el.style.backgroundColor = "transparent";
      el.style.border = "1px solid transparent";
    }
  }

  protected onQuickCopy(event: MouseEvent, value: string): void {
    event.stopPropagation();
    void navigator.clipboard.writeText(value);
  }

  protected kindColor(kind: string): string {
    switch (kind) {
      case "card": return "var(--fk-accent-amber)";
      case "identity": return "var(--fk-accent-cyan)";
      case "note": return "var(--fk-accent-emerald)";
      case "sshKey": return "var(--fk-accent-violet)";
      default: return "var(--color-fg-body-subtle)";
    }
  }

  protected kindBg(kind: string): string {
    switch (kind) {
      case "card": return "var(--fk-accent-amber-subtle)";
      case "identity": return "var(--fk-accent-cyan-subtle)";
      case "note": return "var(--fk-accent-emerald-subtle)";
      case "sshKey": return "var(--fk-accent-violet-subtle)";
      default: return "var(--fk-hover-bg)";
    }
  }

  protected kindLabel(kind: string): string {
    switch (kind) {
      case "card": return "Card";
      case "identity": return "ID";
      case "note": return "Note";
      case "sshKey": return "SSH";
      default: return kind;
    }
  }
}
