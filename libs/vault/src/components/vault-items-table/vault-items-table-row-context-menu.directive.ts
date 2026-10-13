import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from "@angular/core";

import { MenuTriggerForDirective } from "@bitwarden/components";

/**
 * Opens a row's overflow menu on right-click, anchored at the cursor.
 *
 * Applied to the overflow trigger in the actions cell, but the listener is bound to the enclosing
 * `role="row"` element: right-click has to work anywhere on the row, while the menu it opens lives
 * in this cell. The row element is rendered by `bit-table-v2`, which is generic and knows nothing
 * about vault menus, so the ancestor is resolved from the DOM rather than injected.
 *
 * The listener is added natively rather than through a host binding because the target is outside
 * this directive's own host.
 */
@Directive({
  selector: "[vaultItemsTableRowContextMenu]",
})
export class VaultItemsTableRowContextMenuDirective implements AfterViewInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly menuTrigger = inject(MenuTriggerForDirective, { self: true });

  private row: HTMLElement | null = null;

  private readonly onContextMenu = (event: MouseEvent) => {
    // Shift+Ctrl is the escape hatch to the native browser/Electron menu.
    if (event.shiftKey && event.ctrlKey) {
      return;
    }

    this.menuTrigger.toggleMenuOnRightClick(event);
  };

  /** Resolved here rather than in the constructor: the host isn't in the DOM until the view inits. */
  ngAfterViewInit() {
    this.row = this.elementRef.nativeElement.closest<HTMLElement>('[role="row"]');
    this.row?.addEventListener("contextmenu", this.onContextMenu);
  }

  ngOnDestroy() {
    this.row?.removeEventListener("contextmenu", this.onContextMenu);
    this.row = null;
  }
}
