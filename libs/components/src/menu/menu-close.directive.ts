import { Directive } from "@angular/core";

/**
 * Marks a clickable element inside a `bit-menu` as dismissing the menu: clicking it
 * (or any descendant) closes the menu. `bitMenuItem` applies this automatically via
 * `hostDirectives`, so standard menu items close as expected. Add `bitMenuClose` by
 * hand only to non-menu-item content that should also close the menu — e.g.
 * navigation links inside a `dialog`-role menu.
 *
 * The menu detects the marker via the `data-bit-menu-close` attribute this directive
 * binds, which decouples "closes the menu" from ARIA roles.
 */
@Directive({
  selector: "[bitMenuClose]",
  host: {
    "[attr.data-bit-menu-close]": "true",
  },
})
export class MenuCloseDirective {}
