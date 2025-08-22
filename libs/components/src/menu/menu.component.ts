import { FocusKeyManager, CdkTrapFocus } from "@angular/cdk/a11y";
import {
  Component,
  Output,
  TemplateRef,
  EventEmitter,
  AfterContentInit,
  input,
  viewChild,
  contentChildren,
} from "@angular/core";

import { MenuItemDirective } from "./menu-item.directive";

@Component({
  selector: "bit-menu",
  templateUrl: "./menu.component.html",
  exportAs: "menuComponent",
  imports: [CdkTrapFocus],
})
export class MenuComponent implements AfterContentInit {
  readonly templateRef = viewChild.required(TemplateRef);
  @Output() closed = new EventEmitter<void>();
  readonly menuItems = contentChildren(MenuItemDirective, { descendants: true });
  keyManager?: FocusKeyManager<MenuItemDirective>;

  readonly ariaRole = input<"menu" | "dialog">("menu");

  readonly ariaLabel = input<string>();

  ngAfterContentInit() {
    if (this.ariaRole() === "menu") {
      this.keyManager = new FocusKeyManager(this.menuItems())
        .withWrap()
        .skipPredicate((item) => !!item.disabled);
    }
  }
}
