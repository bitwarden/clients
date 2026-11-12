import { html, nothing, ReactiveController, ReactiveControllerHost } from "lit";

import "../../berry/berry";
import "../../icon/icon";
import "../../menu/menu";
import "../../menu/menu-item";
import type { BitwardenIcon } from "../../icon/shared-icon";
import { attachMenuTrigger, MenuTriggerHandle } from "../../menu/attach-menu";
import type { BitMenu } from "../../menu/menu";

/** A tab surfaced in the More menu. */
export type TabMenuEntry = {
  label: string;
  startIcon?: BitwardenIcon;
  endIcon?: BitwardenIcon;
  berryValue?: number;
};

type Host = ReactiveControllerHost & HTMLElement & { hasUpdated: boolean };

/** Connects the tabs' More button to their `bit-menu` for the host's connected lifetime. */
export class TabOverflowMenuController implements ReactiveController {
  private handle?: MenuTriggerHandle;

  constructor(
    private readonly host: Host,
    private readonly getTrigger: () => HTMLElement | null | undefined,
    private readonly getMenu: () => BitMenu | null | undefined,
  ) {
    host.addController(this);
  }

  hostConnected() {
    if (this.host.hasUpdated) {
      this.attach();
    }
  }

  hostUpdated() {
    this.attach();
  }

  hostDisconnected() {
    this.handle?.destroy();
    this.handle = undefined;
  }

  private attach() {
    const trigger = this.getTrigger();
    const menu = this.getMenu();
    if (!this.handle && trigger && menu) {
      this.handle = attachMenuTrigger(trigger, menu);
    }
  }
}

/** Content of a `bit-menu-item` for an overflowed tab. */
export function renderTabMenuItemContent(entry: TabMenuEntry) {
  const hasEnd = !!entry.berryValue || !!entry.endIcon;
  return html`${
    entry.startIcon
      ? html`<bit-icon slot="start" name=${entry.startIcon} class="tw-text-base"></bit-icon>`
      : nothing
  }${entry.label}${
    hasEnd
      ? html`<div slot="end" class="tw-flex tw-items-center tw-gap-1">
          ${entry.berryValue ? html`<bit-berry .value=${entry.berryValue}></bit-berry>` : nothing}
          ${
            entry.endIcon
              ? html`<bit-icon name=${entry.endIcon} class="tw-text-base"></bit-icon>`
              : nothing
          }
        </div>`
      : nothing
  }`;
}
