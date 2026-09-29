import { Directive, HostBinding, HostListener, input } from "@angular/core";

import { MenuTriggerBaseDirective } from "./menu-trigger-base.directive";
import { MenuComponent } from "./menu.component";

@Directive({
  selector: "[bitMenuTriggerFor]",
  exportAs: "menuTrigger",
  host: {
    "[attr.role]": "this.role()",
    "[attr.aria-expanded]": "isOpen()",
  },
})
export class MenuTriggerForDirective extends MenuTriggerBaseDirective {
  @HostBinding("attr.aria-haspopup") get hasPopup(): "menu" | "dialog" {
    return this.menu()?.ariaRole() || "menu";
  }

  readonly role = input("button");

  readonly menu = input.required<MenuComponent>({ alias: "bitMenuTriggerFor" });

  @HostListener("click") toggleMenu() {
    this.isOpen() ? this.destroyMenu() : this.openMenu();
  }

  /**
   * @deprecated Use `ContextMenuTriggerForDirective` — the `[bitContextMenuTriggerFor]` directive
   * in `./context-menu-trigger-for.directive.ts`. It owns the `contextmenu` listener, the
   * shift+ctrl escape hatch to the native menu, and the keyboard equivalent, rather than leaving
   * each of those to the consumer.
   */
  toggleMenuOnRightClick(event: MouseEvent) {
    event.preventDefault();
    this.toggleAtCursor(event);
  }

  private openMenu() {
    this.attachMenu({ positionStrategy: this.elementPositionStrategy(), hasBackdrop: true });
  }
}
