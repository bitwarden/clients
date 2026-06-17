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
      "tw-flex tw-h-full tw-w-60 tw-shrink-0 tw-flex-col tw-gap-0.5 tw-p-3",
    "[style.background-color]": "'var(--fk-sidebar-bg)'",
    "[style.backdrop-filter]": "'blur(var(--fk-blur-chrome)) saturate(1.6)'",
    "[style.-webkit-backdrop-filter]": "'blur(var(--fk-blur-chrome)) saturate(1.6)'",
    "[style.border-right]": "'var(--fk-glass-border)'",
    "[style.box-shadow]": "'var(--fk-glass-highlight)'",
  },
  template: `
    <div class="tw-px-2 tw-pb-3 tw-pt-1 tw-text-[13px] tw-font-semibold tw-uppercase tw-tracking-wide tw-text-fg-body-subtle">
      Vault
    </div>

    @for (item of items(); track item.key) {
      <button
        type="button"
        class="tw-group tw-flex tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-md)] tw-px-3 tw-py-2 tw-text-left tw-text-sm tw-transition-all focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
        [style.transition-duration]="'var(--fk-dur-fast)'"
        [style.transition-timing-function]="'var(--fk-ease)'"
        [class.tw-text-fg-heading]="item.key === active()"
        [class.tw-font-medium]="item.key === active()"
        [class.tw-text-fg-body]="item.key !== active()"
        [style.background-color]="item.key === active() ? 'var(--fk-selected-bg)' : 'transparent'"
        [style.box-shadow]="item.key === active() ? 'var(--fk-elev-glow)' : 'none'"
        (mouseenter)="$any($event.currentTarget).style.backgroundColor = item.key !== active() ? 'var(--fk-hover-bg)' : 'var(--fk-selected-bg)'"
        (mouseleave)="$any($event.currentTarget).style.backgroundColor = item.key === active() ? 'var(--fk-selected-bg)' : 'transparent'"
        (click)="select.emit(item.key)"
      >
        <span
          class="tw-flex tw-size-5 tw-shrink-0 tw-items-center tw-justify-center"
          [class.tw-text-fg-brand]="item.key === active()"
          [class.tw-text-fg-body-subtle]="item.key !== active()"
        >
          @switch (item.key) {
            @case ("all") {
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="4"
                  rx="1"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <rect
                  x="3"
                  y="10"
                  width="18"
                  height="4"
                  rx="1"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <rect
                  x="3"
                  y="16"
                  width="18"
                  height="4"
                  rx="1"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
            }
            @case ("logins") {
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="8" cy="10" r="4" stroke="currentColor" stroke-width="2" />
                <path
                  d="M11 11l8 8m-3 0 3-3m-5-2 2 2"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            }
            @case ("cards") {
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="2"
                  y="5"
                  width="20"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path d="M2 10h20" stroke="currentColor" stroke-width="2" />
              </svg>
            }
            @case ("identities") {
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" />
                <path
                  d="M4 20a8 8 0 0 1 16 0"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            }
            @case ("notes") {
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="5"
                  y="3"
                  width="14"
                  height="18"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path
                  d="M9 8h6M9 12h6M9 16h4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            }
            @case ("favorites") {
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19l1-5.8L3.5 9.2l5.9-.9L12 3Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
              </svg>
            }
          }
        </span>
        <span class="tw-flex-1 tw-truncate">{{ item.label }}</span>
        <span class="tw-text-[12px] tw-tabular-nums tw-text-fg-body-subtle">{{ item.count }}</span>
      </button>
    }
  `,
})
export class KlsSidebarNavComponent {
  readonly items = input.required<NavItem[]>();
  readonly active = input.required<NavCategory>();
  readonly select = output<NavCategory>();
}
