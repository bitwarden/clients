import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { CollectionSummary, FolderSummary } from "@klappstuhl/ui-bridge";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

export type NavCategory =
  | "all"
  | "logins"
  | "cards"
  | "identities"
  | "notes"
  | "sshKeys"
  | "favorites"
  | "trash";

export interface NavItem {
  key: NavCategory;
  label: string;
  count: number;
}

@Component({
  selector: "kls-sidebar-nav",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-h-full tw-w-[252px] tw-shrink-0 tw-flex-col tw-p-3",
    "[style.background-color]": "'var(--fk-sidebar-bg)'",
    "[style.backdrop-filter]": "'blur(var(--fk-blur-chrome)) saturate(1.8)'",
    "[style.-webkit-backdrop-filter]": "'blur(var(--fk-blur-chrome)) saturate(1.8)'",
    "[style.border-right]": "'var(--fk-glass-border)'",
  },
  template: `
    <!-- Logo -->
    <div class="tw-flex tw-items-center tw-gap-2.5 tw-px-2 tw-pb-4 tw-pt-1">
      <svg width="26" height="26" viewBox="0 0 512 512" class="tw-text-fg-brand" aria-hidden="true">
        <path
          fill="currentColor"
          d="M256.09 4.73C191.87 4.73 33.8 60.72 33.8 60.72s-32.51 273.4 22.97 344.42c55.48 71.01 199.32 102.13 199.32 102.13s143.84-31.12 199.32-102.13c55.48-71.01 22.97-344.42 22.97-344.42S320.31 4.73 256.09 4.73zm0 49.45c50.34 0 174.76 42.06 174.76 42.06s25.54 217.43-18.04 273.18c-43.58 55.75-156.72 80.16-156.72 80.16s-113.14-24.41-156.72-80.16c-43.58-55.75-18.04-273.18-18.04-273.18s124.42-42.06 174.76-42.06z"
        />
      </svg>
      <span class="tw-text-[14px] tw-font-semibold tw-text-fg-heading">Bitwarden</span>
    </div>

    <!-- New Item button -->
    <button
      type="button"
      class="tw-mb-3 tw-flex tw-w-full tw-items-center tw-justify-center tw-gap-2 tw-rounded-[var(--fk-radius-full)] tw-py-2 tw-text-[13px] tw-font-medium"
      style="color: #fff; background: linear-gradient(135deg, var(--color-brand-500), var(--color-brand-600)); box-shadow: 0 2px 8px rgb(109 127 245 / 0.3); transition: all var(--fk-dur-fast) var(--fk-ease-spring)"
      (mouseenter)="
        $any($event.currentTarget).style.transform = 'scale(1.02)';
        $any($event.currentTarget).style.boxShadow = '0 4px 14px rgb(109 127 245 / 0.4)'
      "
      (mouseleave)="
        $any($event.currentTarget).style.transform = '';
        $any($event.currentTarget).style.boxShadow = '0 2px 8px rgb(109 127 245 / 0.3)'
      "
      (click)="newItem.emit()"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      {{ i18n.t("addNewItem") || "New Item" }}
    </button>

    <!-- Categories -->
    <div class="tw-flex-1 tw-overflow-y-auto tw-space-y-0.5">
      <div
        class="tw-px-3 tw-py-1 tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-[0.1em] tw-text-fg-body-subtle"
      >
        {{ i18n.t("vault") || "Vault" }}
      </div>

      @for (item of items(); track item.key) {
        <button
          type="button"
          class="tw-group tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-lg)] tw-px-3 tw-py-2 tw-text-left tw-text-[13px] focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[color:var(--color-border-focus)]"
          [style.transition]="'all var(--fk-dur-fast) var(--fk-ease)'"
          [class.tw-text-fg-heading]="item.key === active() && !activeFolder()"
          [class.tw-font-medium]="item.key === active() && !activeFolder()"
          [class.tw-text-fg-body]="item.key !== active() || !!activeFolder()"
          [style.background-color]="
            item.key === active() && !activeFolder() ? 'var(--fk-card-bg)' : 'transparent'
          "
          [style.border]="
            item.key === active() && !activeFolder()
              ? 'var(--fk-glass-border)'
              : '1px solid transparent'
          "
          [style.box-shadow]="
            item.key === active() && !activeFolder()
              ? 'var(--fk-glass-highlight), var(--fk-elev-xs)'
              : 'none'
          "
          (mouseenter)="
            onHover($any($event.currentTarget), item.key !== active() || !!activeFolder())
          "
          (mouseleave)="
            onLeave($any($event.currentTarget), item.key === active() && !activeFolder())
          "
          (click)="select.emit(item.key)"
        >
          <span
            class="tw-flex tw-size-6 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-[var(--fk-radius-sm)]"
            [class.tw-text-fg-brand]="item.key === active() && !activeFolder()"
            [class.tw-text-fg-body-subtle]="item.key !== active() || !!activeFolder()"
          >
            @switch (item.key) {
              @case ("all") {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="4"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.75"
                  />
                  <rect
                    x="3"
                    y="10"
                    width="18"
                    height="4"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.75"
                  />
                  <rect
                    x="3"
                    y="16"
                    width="18"
                    height="4"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.75"
                  />
                </svg>
              }
              @case ("logins") {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="8" cy="10" r="4" stroke="currentColor" stroke-width="1.75" />
                  <path
                    d="M11 11l8 8m-3 0 3-3"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                  />
                </svg>
              }
              @case ("cards") {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="2"
                    y="5"
                    width="20"
                    height="14"
                    rx="2.5"
                    stroke="currentColor"
                    stroke-width="1.75"
                  />
                  <path d="M2 10h20" stroke="currentColor" stroke-width="1.75" />
                </svg>
              }
              @case ("identities") {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.75" />
                  <path
                    d="M4 20a8 8 0 0 1 16 0"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                  />
                </svg>
              }
              @case ("notes") {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="5"
                    y="3"
                    width="14"
                    height="18"
                    rx="2.5"
                    stroke="currentColor"
                    stroke-width="1.75"
                  />
                  <path
                    d="M9 8h6M9 12h6M9 16h4"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                  />
                </svg>
              }
              @case ("sshKeys") {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M2 17l1.5-1.5M7 12l-5 5 2 2 5-5m1.5-1.5L15 8m-3.5 4.5 3.5 3.5 5-5-3.5-3.5"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <circle cx="17.5" cy="6.5" r="2.5" stroke="currentColor" stroke-width="1.75" />
                </svg>
              }
              @case ("favorites") {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19l1-5.8L3.5 9.2l5.9-.9L12 3Z"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linejoin="round"
                  />
                </svg>
              }
              @case ("trash") {
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              }
            }
          </span>
          <span class="tw-flex-1 tw-truncate">{{ item.label }}</span>
          <span
            class="tw-min-w-[18px] tw-text-right tw-text-[11px] tw-tabular-nums tw-text-fg-body-subtle"
            >{{ item.count }}</span
          >
        </button>
      }

      <!-- Folders section -->
      @if (folders().length > 0) {
        <div class="tw-m-3" style="border-top: var(--fk-glass-border)"></div>
        <div
          class="tw-px-3 tw-pb-1 tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-[0.1em] tw-text-fg-body-subtle"
        >
          {{ i18n.t("folders") || "Folders" }}
        </div>
        @for (folder of folders(); track folder.id) {
          <button
            type="button"
            class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-lg)] tw-px-3 tw-py-2 tw-text-left tw-text-[13px]"
            [style.transition]="'all var(--fk-dur-fast) var(--fk-ease)'"
            [class.tw-text-fg-heading]="folder.id === activeFolder()"
            [class.tw-font-medium]="folder.id === activeFolder()"
            [class.tw-text-fg-body]="folder.id !== activeFolder()"
            [style.background-color]="
              folder.id === activeFolder() ? 'var(--fk-card-bg)' : 'transparent'
            "
            [style.border]="
              folder.id === activeFolder() ? 'var(--fk-glass-border)' : '1px solid transparent'
            "
            (mouseenter)="onHover($any($event.currentTarget), folder.id !== activeFolder())"
            (mouseleave)="onLeave($any($event.currentTarget), folder.id === activeFolder())"
            (click)="selectFolder.emit(folder.id)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              class="tw-shrink-0 tw-text-fg-body-subtle"
            >
              <path
                d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
                stroke="currentColor"
                stroke-width="1.75"
              />
            </svg>
            <span class="tw-flex-1 tw-truncate">{{ folder.name }}</span>
          </button>
        }
      }

      <!-- Collections (Tresor) section -->
      @if (collections().length > 0) {
        <div class="tw-m-3" style="border-top: var(--fk-glass-border)"></div>
        <div
          class="tw-px-3 tw-pb-1 tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-[0.1em] tw-text-fg-body-subtle"
        >
          {{ i18n.t("collections") || "Collections" }}
        </div>
        @for (col of collections(); track col.id) {
          <button
            type="button"
            class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-lg)] tw-px-3 tw-py-2 tw-text-left tw-text-[13px]"
            [style.transition]="'all var(--fk-dur-fast) var(--fk-ease)'"
            [class.tw-text-fg-heading]="col.id === activeCollection()"
            [class.tw-font-medium]="col.id === activeCollection()"
            [class.tw-text-fg-body]="col.id !== activeCollection()"
            [style.background-color]="
              col.id === activeCollection() ? 'var(--fk-card-bg)' : 'transparent'
            "
            [style.border]="
              col.id === activeCollection() ? 'var(--fk-glass-border)' : '1px solid transparent'
            "
            (mouseenter)="onHover($any($event.currentTarget), col.id !== activeCollection())"
            (mouseleave)="onLeave($any($event.currentTarget), col.id === activeCollection())"
            (click)="selectCollection.emit(col.id)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              class="tw-shrink-0 tw-text-fg-body-subtle"
            >
              <rect
                x="3"
                y="3"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.75"
              />
              <rect
                x="14"
                y="3"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.75"
              />
              <rect
                x="3"
                y="14"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.75"
              />
              <rect
                x="14"
                y="14"
                width="7"
                height="7"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.75"
              />
            </svg>
            <span class="tw-flex-1 tw-truncate">{{ col.name }}</span>
          </button>
        }
      }
    </div>

    <!-- Bottom tools -->
    <div class="tw-mt-2 tw-space-y-0.5 tw-pt-3" style="border-top: var(--fk-glass-border)">
      <div
        class="tw-px-3 tw-pb-1 tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-[0.1em] tw-text-fg-body-subtle"
      >
        {{ i18n.t("tools") || "Tools" }}
      </div>
      <button
        type="button"
        class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-lg)] tw-px-3 tw-py-2 tw-text-left tw-text-[13px] tw-text-fg-body"
        style="transition: all var(--fk-dur-fast) var(--fk-ease)"
        (mouseenter)="onHover($any($event.currentTarget), true)"
        (mouseleave)="onLeave($any($event.currentTarget), false)"
        (click)="openGenerator.emit()"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="tw-text-fg-body-subtle">
          <path
            d="M4 7h16M4 12h10M4 17h6"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
          />
          <circle cx="19" cy="15" r="3" stroke="currentColor" stroke-width="1.75" />
          <path d="M21 17l2 2" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
        </svg>
        {{ i18n.t("generator") || "Generator" }}
      </button>
      <button
        type="button"
        class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-lg)] tw-px-3 tw-py-2 tw-text-left tw-text-[13px] tw-text-fg-body"
        style="transition: all var(--fk-dur-fast) var(--fk-ease)"
        (mouseenter)="onHover($any($event.currentTarget), true)"
        (mouseleave)="onLeave($any($event.currentTarget), false)"
        (click)="openImport.emit()"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="tw-text-fg-body-subtle">
          <path
            d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {{ i18n.t("importNoun") || "Import" }}
      </button>
      <button
        type="button"
        class="tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-[var(--fk-radius-lg)] tw-px-3 tw-py-2 tw-text-left tw-text-[13px] tw-text-fg-body"
        style="transition: all var(--fk-dur-fast) var(--fk-ease)"
        (mouseenter)="onHover($any($event.currentTarget), true)"
        (mouseleave)="onLeave($any($event.currentTarget), false)"
        (click)="openExport.emit()"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="tw-text-fg-body-subtle">
          <path
            d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {{ i18n.t("exportNoun") || "Export" }}
      </button>
    </div>

    <!-- Account card footer -->
    <div
      class="tw-mt-3 tw-flex tw-items-center tw-gap-2 tw-rounded-[var(--fk-radius-lg)] tw-p-1.5"
      style="background-color: var(--fk-card-bg); border: var(--fk-glass-border); box-shadow: var(--fk-elev-glow)"
    >
      <div class="tw-min-w-0 tw-flex-1">
        <ng-content select="[account-switcher]"></ng-content>
      </div>
      <button
        type="button"
        class="tw-shrink-0 tw-rounded-[var(--fk-radius-full)] tw-p-2 tw-text-fg-body-subtle"
        style="transition: all var(--fk-dur-fast) var(--fk-ease)"
        [title]="i18n.t('settings') || 'Settings'"
        (mouseenter)="
          $any($event.currentTarget).style.color = 'var(--color-fg-brand)';
          $any($event.currentTarget).style.backgroundColor = 'var(--fk-hover-bg)'
        "
        (mouseleave)="
          $any($event.currentTarget).style.color = '';
          $any($event.currentTarget).style.backgroundColor = ''
        "
        (click)="openSettings.emit()"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3.25" stroke="currentColor" stroke-width="1.6" />
          <path
            d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
  `,
})
export class KlsSidebarNavComponent {
  protected readonly i18n = inject(I18nService);
  readonly items = input.required<NavItem[]>();
  readonly active = input.required<NavCategory>();
  readonly activeFolder = input<string | undefined>(undefined);
  readonly activeCollection = input<string | undefined>(undefined);
  readonly folders = input<readonly FolderSummary[]>([]);
  readonly collections = input<readonly CollectionSummary[]>([]);
  readonly select = output<NavCategory>();
  readonly selectFolder = output<string>();
  readonly selectCollection = output<string>();
  readonly newItem = output<void>();
  readonly openGenerator = output<void>();
  readonly openImport = output<void>();
  readonly openExport = output<void>();
  readonly openSettings = output<void>();

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
