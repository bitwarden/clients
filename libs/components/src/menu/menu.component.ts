import { FocusKeyManager, CdkTrapFocus } from "@angular/cdk/a11y";
import {
  Component,
  TemplateRef,
  effect,
  input,
  output,
  signal,
  viewChild,
  contentChildren,
  ChangeDetectionStrategy,
} from "@angular/core";

import { MenuItemComponent } from "./menu-item.component";

@Component({
  selector: "bit-menu",
  templateUrl: "./menu.component.html",
  exportAs: "menuComponent",
  imports: [CdkTrapFocus],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuComponent {
  readonly templateRef = viewChild.required(TemplateRef);
  readonly closed = output<void>();
  readonly menuItems = contentChildren(MenuItemComponent, { descendants: true });
  readonly keyManager = signal<FocusKeyManager<MenuItemComponent> | undefined>(undefined);

  readonly ariaRole = input<"menu" | "dialog">("menu");

  readonly ariaLabel = input<string>();

  constructor() {
    effect(() => {
      if (this.ariaRole() === "menu") {
        this.keyManager.set(
          new FocusKeyManager(this.menuItems()).withWrap().skipPredicate((item) => !!item.disabled),
        );
      }
    });
  }
}
