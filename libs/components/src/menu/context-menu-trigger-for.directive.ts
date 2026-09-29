import { Directive, input } from "@angular/core";

import { MenuTriggerBaseDirective } from "./menu-trigger-base.directive";
import { MenuComponent } from "./menu.component";

/**
 * Opens a `bit-menu` on right-click, anchored at the cursor.
 *
 * The host is a region rather than a button — a table row, a card — so this directive never sets
 * a `role`. Give the host a `tabindex`: that's what makes the keyboard equivalent (`Shift+F10` or
 * the `ContextMenu` key) reachable, and what lets focus return to the host on close.
 */
@Directive({
  selector: "[bitContextMenuTriggerFor]",
  exportAs: "contextMenuTrigger",
  host: {
    "(contextmenu)": "onContextMenu($event)",
    "(keydown)": "onKeydown($event)",
  },
})
export class ContextMenuTriggerForDirective extends MenuTriggerBaseDirective {
  readonly menu = input.required<MenuComponent>({ alias: "bitContextMenuTriggerFor" });

  protected onContextMenu(event: MouseEvent) {
    // Shift+Ctrl is the escape hatch to the native browser/Electron menu.
    if (event.shiftKey && event.ctrlKey) {
      return;
    }

    event.preventDefault();

    // Windows and Linux raise a contextmenu as the default action of Shift+F10 and the ContextMenu
    // key, which would otherwise place a keyboard-opened menu to wherever the pointer sits.
    if (this.isOpen() && !this.cursorAnchored) {
      return;
    }

    this.toggleAtCursor(event);
  }

  protected onKeydown(event: KeyboardEvent) {
    // Windows and Linux already reach onContextMenu natively; this is what gives macOS, which
    // maps neither key to a contextmenu event, a keyboard path to the menu.
    const isContextMenuKey = event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
    if (!isContextMenuKey || this.isOpen()) {
      return;
    }

    event.preventDefault();

    // No cursor to anchor to, so fall back to the element — and to a normal menu's backdrop.
    this.attachMenu({ positionStrategy: this.elementPositionStrategy(), hasBackdrop: true });
  }
}
