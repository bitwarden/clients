import { setAriaAttributes } from "../core/aria";
import { captureFocus, getFocusableElements, trapFocus } from "../core/focus";
import { KeyManager } from "../core/key-manager";
import { registerOverlay } from "../core/overlay";
import { autoUpdate, computePosition, Placement } from "../core/position";

import type { BitMenu } from "./menu";
import {
  MENU_TRIGGER_GAP_PX,
  MENU_VIEWPORT_MARGIN_PX,
  MenuPosition,
  menuPlacements,
} from "./menu-positions";

export type MenuTriggerOptions = {
  /** Preferred position; the others are tried if it doesn't fit. Defaults to `"below-start"`. */
  position?: MenuPosition;
  /** Also open on right-click, at the pointer. */
  contextMenu?: boolean;
  /** `role` for the trigger. Defaults to `"button"`. */
  role?: string;
  /** Called when the menu opens or closes. */
  onOpenChange?: (open: boolean) => void;
};

export type MenuTriggerHandle = {
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  toggle(): void;
  /** Opens at the pointer, or moves an open menu there. Call from a `contextmenu` listener. */
  toggleOnRightClick(event: MouseEvent): void;
  update(options: Partial<MenuTriggerOptions>): void;
  destroy(): void;
};

type TooltipHost = HTMLElement & { setTooltipSuppressed?: (suppressed: boolean) => void };

/**
 * Opens `menu` when `trigger` is clicked, replacing `bitMenuTriggerFor`. Sets `aria-haspopup` and
 * `aria-expanded`, and suppresses a `bit-icon-button` trigger's tooltip while the menu is open.
 *
 * The menu closes on item click, Escape, Tab (`menu` role), or an outside click, returning focus
 * to the trigger.
 */
export function attachMenuTrigger(
  trigger: HTMLElement,
  menu: BitMenu,
  initial: MenuTriggerOptions = {},
): MenuTriggerHandle {
  let options = initial;
  let isOpen = false;
  let cleanups: (() => void)[] = [];
  let pointAnchor: HTMLElement | undefined;
  let placements: Placement[] = [];
  let reposition = () => {};

  const syncAria = () =>
    void setAriaAttributes(trigger, {
      role: options.role ?? "button",
      "aria-haspopup": menu.menuRole,
      "aria-expanded": String(isOpen),
    });
  syncAria();

  const owner = { close: () => close(false) };

  const close = (focusTrigger: boolean) => {
    if (!isOpen) {
      return;
    }
    isOpen = false;
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];
    if (focusTrigger) {
      // The active item is about to be hidden.
      trigger.focus();
    }
    (trigger as TooltipHost).setTooltipSuppressed?.(false);
    syncAria();
    menu._hide(owner);
    options.onOpenChange?.(false);
  };

  const open = (event?: MouseEvent) => {
    if (isOpen) {
      return;
    }
    isOpen = true;
    (trigger as TooltipHost).setTooltipSuppressed?.(true);
    syncAria();

    const isContextMenu = !!event;
    const isMenuRole = menu.menuRole === "menu";
    const keyManager = new KeyManager({
      items: () => menu._items(),
      wrap: true,
      typeahead: true,
    });
    const focusFirstItem = () =>
      isMenuRole ? keyManager.setFirstItemActive() : getFocusableElements(menu._menu)[0]?.focus();
    menu._show(owner, {
      backdrop: !isContextMenu,
      onBackdropClick: () => close(true),
      onRequestClose: () => close(true),
      onFocusFirstItem: focusFirstItem,
    });

    const floating = menu._floating;
    pointAnchor = event ? menu._point(event.clientX, event.clientY) : undefined;
    placements = menuPlacements(options.position);
    // Like a locked CDK position: keep the first placement that fit, but stay pushed on-screen.
    reposition = () => {
      const { placement } = computePosition(pointAnchor ?? trigger, floating, {
        placements,
        offset: MENU_TRIGGER_GAP_PX,
        viewportMargin: MENU_VIEWPORT_MARGIN_PX,
      });
      placements = [placement];
    };
    cleanups.push(autoUpdate(pointAnchor ?? trigger, floating, () => reposition()));

    const onPanelKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Keeps Escape from also closing a parent, like a dialog or the extension window.
        e.preventDefault();
        close(true);
      } else if (e.key === "Tab" && isMenuRole) {
        close(true);
      } else if (isMenuRole && keyManager.onKeydown(e)) {
        e.preventDefault();
      }
    };
    floating.addEventListener("keydown", onPanelKeydown);
    cleanups.push(() => floating.removeEventListener("keydown", onPanelKeydown));

    // Receives keys while focus is outside the panel, e.g. after clicking non-focusable content.
    cleanups.push(
      registerOverlay({
        onKeydown: (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            close(true);
          }
          return true;
        },
      }),
    );

    if (isContextMenu) {
      const onOutside = (e: PointerEvent) => {
        if (!e.composedPath().includes(floating)) {
          close(false);
        }
      };
      document.addEventListener("pointerdown", onOutside, true);
      cleanups.push(() => document.removeEventListener("pointerdown", onOutside, true));
    }

    if (!isMenuRole) {
      const restoreFocus = captureFocus();
      cleanups.push(trapFocus(menu._menu), restoreFocus);
    }
    void menu.updateComplete.then(() => {
      if (isOpen) {
        focusFirstItem();
      }
    });
    options.onOpenChange?.(true);
  };

  const onClick = () => (isOpen ? close(false) : open());
  const toggleOnRightClick = (event: MouseEvent) => {
    event.preventDefault();
    if (isOpen && pointAnchor) {
      menu._point(event.clientX, event.clientY);
      placements = menuPlacements(options.position);
      reposition();
    } else if (!isOpen) {
      open(event);
    }
  };
  const onContextMenu = (event: MouseEvent) => options.contextMenu && toggleOnRightClick(event);

  trigger.addEventListener("click", onClick);
  trigger.addEventListener("contextmenu", onContextMenu);

  return {
    get isOpen() {
      return isOpen;
    },
    open: () => open(),
    close: () => close(true),
    toggle: onClick,
    toggleOnRightClick,
    update(next) {
      options = { ...options, ...next };
      syncAria();
    },
    destroy() {
      close(false);
      trigger.removeEventListener("click", onClick);
      trigger.removeEventListener("contextmenu", onContextMenu);
      void setAriaAttributes(trigger, {
        role: null,
        "aria-haspopup": null,
        "aria-expanded": null,
      });
    },
  };
}
