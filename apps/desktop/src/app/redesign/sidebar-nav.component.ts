import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

export type NavCategory = "all" | "logins" | "cards" | "identities" | "notes" | "favorites";

export interface NavItem {
  key: NavCategory;
  label: string;
  count: number;
}

/**
 * Left sidebar navigation. Pure presentation: receives the category list +
 * counts and the active key, emits selection. Translucent + blurred chrome for
 * the premium depth effect.
 */
@Component({
  selector: "kls-sidebar-nav",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      "tw-flex tw-h-full tw-w-[252px] tw-shrink-0 tw-flex-col tw-gap-1 tw-p-3",
    "[style.background-color]": "'var(--fk-sidebar-bg)'",
    "[style.backdrop-filter]": "'blur(var(--fk-blur-chrome)) saturate(1.8)'",
    "[style.-webkit-backdrop-filter]": "'blur(var(--fk-blur-chrome)) saturate(1.8)'",
    "[style.border-right]": "'var(--fk-glass-border)'",
    "[style.box-shadow]": "'var(--fk-glass-highlight)'",
  },
  template: `
    <div class="tw-mb-1 tw-px-3 tw-pb-2 tw-pt-2 tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-fg-body-subtle">
      Vault
    </div>

    @for (item of items(); track item.key) {
      <button
        type="button"
        class="tw-group tw-relative tw-flex tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-lg)] tw-px-3 tw-py-2.5 tw-text-left tw-text-[13px] focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
        [style.transition]="'all var(--fk-dur-fast) var(--fk-ease)'"
        [class.tw-text-fg-heading]="item.key === active()"
        [class.tw-font-medium]="item.key === active()"
        [class.tw-text-fg-body]="item.key !== active()"
        [style.background-color]="item.key === active() ? 'var(--fk-card-bg)' : 'transparent'"
        [style.backdrop-filter]="item.key === active() ? 'blur(var(--fk-blur-subtle))' : 'none'"
        [style.-webkit-backdrop-filter]="item.key === active() ? 'blur(var(--fk-blur-subtle))' : 'none'"
        [style.border]="item.key === active() ? 'var(--fk-glass-border)' : '1px solid transparent'"
        [style.box-shadow]="item.key === active() ? 'var(--fk-glass-highlight), var(--fk-elev-xs)' : 'none'"
        (mouseenter)="onHover($any($event.currentTarget), item.key !== active())"
        (mouseleave)="onLeave($any($event.currentTarget), item.key === active())"
        (click)="select.emit(item.key)"
      >
        <span
          class="tw-flex tw-size-7 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-[var(--fk-radius-md)]"
          [class.tw-text-fg-brand]="item.key === active()"
          [class.tw-text-fg-body-subtle]="item.key !== active()"
          [style.background-color]="item.key === active() ? 'var(--fk-selected-bg)' : 'transparent'"
          [style.transition]="'background-color var(--fk-dur-fast) var(--fk-ease)'"
        >
          @switch (item.key) {
            @case ("all") {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="4" width="18" height="4" rx="1.5" stroke="currentColor" stroke-width="1.75" />
                <rect x="3" y="10" width="18" height="4" rx="1.5" stroke="currentColor" stroke-width="1.75" />
                <rect x="3" y="16" width="18" height="4" rx="1.5" stroke="currentColor" stroke-width="1.75" />
              </svg>
            }
            @case ("logins") {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="8" cy="10" r="4" stroke="currentColor" stroke-width="1.75" />
                <path d="M11 11l8 8m-3 0 3-3m-5-2 2 2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            }
            @case ("cards") {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2.5" stroke="currentColor" stroke-width="1.75" />
                <path d="M2 10h20" stroke="currentColor" stroke-width="1.75" />
              </svg>
            }
            @case ("identities") {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.75" />
                <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
              </svg>
            }
            @case ("notes") {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="3" width="14" height="18" rx="2.5" stroke="currentColor" stroke-width="1.75" />
                <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
              </svg>
            }
            @case ("favorites") {
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19l1-5.8L3.5 9.2l5.9-.9L12 3Z" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" />
              </svg>
            }
          }
        </span>
        <span class="tw-flex-1 tw-truncate">{{ item.label }}</span>
        <span
          class="tw-min-w-[20px] tw-rounded-[var(--fk-radius-full)] tw-px-1.5 tw-py-0.5 tw-text-center tw-text-[11px] tw-tabular-nums tw-font-medium"
          [class.tw-text-fg-brand]="item.key === active()"
          [class.tw-text-fg-body-subtle]="item.key !== active()"
          [style.background-color]="item.key === active() ? 'var(--fk-selected-bg)' : 'transparent'"
        >
          {{ item.count }}
        </span>
      </button>
    }
  `,
})
export class KlsSidebarNavComponent {
  readonly items = input.required<NavItem[]>();
  readonly active = input.required<NavCategory>();
  readonly select = output<NavCategory>();

  protected onHover(el: HTMLElement, isInactive: boolean): void {
    if (isInactive) {
      el.style.backgroundColor = "var(--fk-hover-bg)";
      el.style.border = "var(--fk-glass-border)";
      el.style.transform = "translateX(2px)";
    }
  }

  protected onLeave(el: HTMLElement, isActive: boolean): void {
    if (!isActive) {
      el.style.backgroundColor = "transparent";
      el.style.border = "1px solid transparent";
      el.style.transform = "translateX(0)";
    }
  }
}
