import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { CollectionSummary, FolderSummary } from "@klappstuhl/ui-bridge";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
    <div class="tw-flex tw-items-center tw-px-2 tw-pb-4 tw-pt-1">
      <svg
        viewBox="0 0 290 45"
        xmlns="http://www.w3.org/2000/svg"
        style="height: 22px; width: auto"
        role="img"
        aria-label="Bitwarden"
      >
        <title>Bitwarden</title>
        <path
          class="tw-fill-marketing-logo"
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M69.799 10.713c3.325 0 5.911 1.248 7.811 3.848 1.9 2.549 2.85 6.033 2.85 10.453 0 4.576-.95 8.113-2.902 10.61-1.953 2.547-4.592 3.743-7.918 3.743-3.325 0-5.858-1.144-7.758-3.536h-.528l-1.003 2.444a.976.976 0 0 1-.897.572H55.23a.94.94 0 0 1-.95-.936V1.352a.94.94 0 0 1 .95-.936h5.7a.94.94 0 0 1 .95.936v8.009c0 1.144-.105 2.964-.316 5.46h.317c1.741-2.704 4.433-4.108 7.917-4.108Zm-2.428 6.084c-1.847 0-3.273.572-4.17 1.717-.844 1.144-1.32 3.068-1.32 5.668v.832c0 2.964.423 5.097 1.32 6.345.897 1.248 2.322 1.924 4.275 1.924 1.531 0 2.85-.728 3.748-2.184.897-1.404 1.372-3.537 1.372-6.189 0-2.704-.475-4.732-1.372-6.084-.95-1.352-2.27-2.029-3.853-2.029ZM93.022 38.9h-5.7a.94.94 0 0 1-.95-.936V12.221a.94.94 0 0 1 .95-.936h5.7a.94.94 0 0 1 .95.936v25.69c.053.468-.422.988-.95.988Zm20.849-5.564c1.108 0 2.428-.208 4.011-.624a.632.632 0 0 1 .792.624v4.316a.64.64 0 0 1-.37.572c-1.794.728-4.064 1.092-6.597 1.092-3.062 0-5.278-.728-6.651-2.288-1.372-1.508-2.111-3.796-2.111-6.812V16.953h-3.008c-.37 0-.634-.26-.634-.624v-2.444c0-.052.053-.104.053-.156l4.17-2.444 2.058-5.408c.106-.26.317-.417.581-.417h3.8c.369 0 .633.26.633.625v5.252h7.548c.158 0 .317.156.317.312v4.68c0 .364-.264.624-.634.624h-7.178v13.21c0 1.04.317 1.872.897 2.34.528.572 1.373.832 2.323.832Zm35.521 5.564c-.739 0-1.319-.468-1.636-1.144l-5.595-16.797c-.369-1.196-.844-3.016-1.478-5.357h-.158l-.528 1.873-1.108 3.536-5.753 16.797c-.211.676-.845 1.092-1.584 1.092a1.628 1.628 0 0 1-1.583-1.196l-7.02-24.182c-.211-.728.369-1.508 1.214-1.508h.158c.528 0 1.003.364 1.161.884l4.117 14.717c1.003 3.849 1.689 6.657 2.006 8.53h.158c.95-3.85 1.689-6.397 2.164-7.698l5.331-15.393c.211-.624.792-1.04 1.531-1.04.686 0 1.267.416 1.478 1.04l4.961 15.29c1.214 3.9 1.953 6.396 2.217 7.696h.158c.159-1.04.792-3.952 2.006-8.633l3.958-14.509c.159-.52.634-.884 1.162-.884.791 0 1.372.728 1.161 1.508l-6.651 24.182c-.211.728-.844 1.196-1.636 1.196h-.211Zm31.352 0a.962.962 0 0 1-.95-.832l-.475-3.432h-.264c-1.372 1.716-2.745 2.964-4.223 3.692-1.425.728-3.166 1.04-5.119 1.04-2.692 0-4.751-.676-6.228-2.028-1.32-1.196-2.059-2.808-2.164-4.836-.212-2.704.95-5.305 3.166-6.813 2.27-1.456 5.437-2.34 9.712-2.34l5.173-.156v-1.768c0-2.6-.528-4.473-1.637-5.773-1.108-1.3-2.744-1.924-5.067-1.924-2.216 0-4.433.52-6.756 1.612-.58.26-1.266 0-1.53-.572s0-1.248.58-1.456c2.639-1.04 5.226-1.612 7.865-1.612 3.008 0 5.225.78 6.756 2.34 1.478 1.508 2.216 3.953 2.216 7.125v16.901c-.052.312-.527.832-1.055.832Zm-10.926-1.768c2.956 0 5.226-.832 6.862-2.444 1.689-1.612 2.533-3.952 2.533-6.813v-2.6l-4.75.208c-3.853.156-6.545.78-8.234 1.768-1.636.988-2.481 2.6-2.481 4.68 0 1.665.528 3.017 1.531 3.953 1.161.78 2.639 1.248 4.539 1.248Zm31.246-25.638c.792 0 1.584.052 2.481.156a1.176 1.176 0 0 1 1.003 1.352c-.106.624-.739.988-1.372.884-.792-.104-1.584-.208-2.375-.208-2.323 0-4.223.988-5.701 2.912-1.478 1.925-2.217 4.42-2.217 7.333v13.625c0 .676-.527 1.196-1.214 1.196-.686 0-1.213-.52-1.213-1.196V13.105c0-.572.475-1.04 1.055-1.04.581 0 1.056.416 1.056.988l.211 3.848h.158c1.109-1.976 2.323-3.38 3.589-4.16 1.214-.832 2.745-1.248 4.539-1.248Zm18.579 0c1.953 0 3.695.364 5.12 1.04 1.478.676 2.745 1.924 3.853 3.64h.158a122.343 122.343 0 0 1-.158-6.084V1.612c0-.676.528-1.196 1.214-1.196.686 0 1.214.52 1.214 1.196v36.351c0 .468-.37.832-.845.832a.852.852 0 0 1-.844-.78l-.528-3.38h-.211c-2.058 3.068-5.067 4.576-8.92 4.576-3.8 0-6.598-1.144-8.656-3.484-1.953-2.34-3.008-5.668-3.008-10.089 0-4.628.95-8.165 2.955-10.66 2.006-2.237 4.856-3.485 8.656-3.485Zm0 2.236c-3.008 0-5.225 1.04-6.756 3.12-1.478 2.029-2.216 4.993-2.216 8.945 0 7.593 3.008 11.39 9.025 11.39 3.114 0 5.331-.885 6.756-2.653 1.478-1.768 2.164-4.68 2.164-8.737v-.416c0-4.16-.686-7.124-2.164-8.893-1.372-1.872-3.642-2.756-6.809-2.756Zm31.616 25.638c-3.959 0-7.02-1.196-9.289-3.64-2.217-2.392-3.326-5.772-3.326-10.089 0-4.316 1.056-7.748 3.22-10.297 2.164-2.6 5.014-3.9 8.656-3.9 3.167 0 5.753 1.092 7.548 3.276 1.9 2.184 2.797 5.2 2.797 8.997v1.976h-19.634c.052 3.692.897 6.5 2.639 8.477 1.741 1.976 4.169 2.86 7.389 2.86 1.531 0 2.956-.104 4.117-.312.844-.156 1.847-.416 3.061-.832.686-.26 1.425.26 1.425.988 0 .416-.264.832-.686.988-1.267.52-2.481.832-3.589 1.04-1.32.364-2.745.468-4.328.468Zm-.739-25.69c-2.639 0-4.75.832-6.334 2.548-1.583 1.665-2.48 4.16-2.797 7.333h16.89c0-3.068-.686-5.564-2.059-7.28-1.372-1.717-3.272-2.6-5.7-2.6ZM288.733 38.9c-.686 0-1.214-.52-1.214-1.196V21.426c0-2.704-.58-4.68-1.689-5.877-1.214-1.196-2.955-1.872-5.383-1.872-3.273 0-5.648.78-7.126 2.444-1.478 1.613-2.322 4.265-2.322 7.853V37.6c0 .676-.528 1.196-1.214 1.196-.686 0-1.214-.52-1.214-1.196V13.105c0-.624.475-1.092 1.108-1.092.581 0 1.003.416 1.109.936l.316 2.704h.159c1.794-2.808 4.908-4.212 9.448-4.212 6.175 0 9.289 3.276 9.289 9.829V37.6c-.053.727-.633 1.3-1.267 1.3ZM90.225 0c-2.48 0-4.486 1.872-4.486 4.212v.416c0 2.289 2.058 4.213 4.486 4.213s4.486-1.924 4.486-4.213v-.364C94.711 1.872 92.653 0 90.225 0Z"
        ></path>
        <path
          class="tw-fill-marketing-logo"
          d="M32.041 24.546V5.95H18.848v33.035c2.336-1.22 4.427-2.547 6.272-3.98 4.614-3.565 6.921-7.051 6.921-10.46Zm5.654-22.314v22.314c0 1.665-.329 3.317-.986 4.953-.658 1.637-1.473 3.09-2.445 4.359-.971 1.268-2.13 2.503-3.475 3.704-1.345 1.2-2.586 2.199-3.725 2.993a46.963 46.963 0 0 1-3.563 2.251c-1.237.707-2.116 1.187-2.636 1.439-.52.251-.938.445-1.252.58-.235.117-.49.175-.765.175s-.53-.058-.766-.174c-.314-.136-.731-.33-1.252-.581-.52-.252-1.398-.732-2.635-1.439a47.003 47.003 0 0 1-3.564-2.251c-1.138-.794-2.38-1.792-3.725-2.993-1.345-1.2-2.503-2.436-3.475-3.704-.972-1.27-1.787-2.722-2.444-4.359C.329 27.863 0 26.211 0 24.546V2.232c0-.504.187-.94.56-1.308A1.823 1.823 0 0 1 1.885.372H35.81c.511 0 .953.184 1.326.552.373.368.56.804.56 1.308Z"
        ></path>
      </svg>
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
    <div class="tw-flex-1 tw-space-y-0.5 tw-overflow-y-auto tw-overflow-x-hidden">
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
      <div class="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-2.5">
        <span class="tw-shrink-0">
          <ng-content select="[account-switcher]"></ng-content>
        </span>
        @if (accountName()) {
          <div class="tw-min-w-0 tw-flex-1 tw-leading-tight">
            <div class="tw-truncate tw-text-[12px] tw-font-medium tw-text-fg-heading">
              {{ accountName() }}
            </div>
            @if (accountEmail() && accountEmail() !== accountName()) {
              <div class="tw-truncate tw-text-[11px] tw-text-fg-body-subtle">
                {{ accountEmail() }}
              </div>
            }
          </div>
        }
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
  private readonly accountService = inject(AccountService);

  private readonly activeAccount = toSignal(this.accountService.activeAccount$, {
    initialValue: null,
  });
  protected readonly accountName = computed(() => this.activeAccount()?.name ?? "");
  protected readonly accountEmail = computed(() => this.activeAccount()?.email ?? "");

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
