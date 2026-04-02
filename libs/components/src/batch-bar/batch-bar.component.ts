import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
} from "@angular/core";

import { BitActionDirective } from "../async-actions/bit-action.directive";
import { ButtonComponent } from "../button/button.component";
import { IconComponent } from "../icon/icon.component";
import { BitIconButtonComponent } from "../icon-button/icon-button.component";
import { MenuItemComponent } from "../menu/menu-item.component";
import { MenuTriggerForDirective } from "../menu/menu-trigger-for.directive";
import { MenuComponent } from "../menu/menu.component";
import { BitwardenIcon } from "../shared/icon";
import { TooltipDirective } from "../tooltip/tooltip.directive";
import { FunctionReturningAwaitable } from "../utils/function-to-observable";

export interface BatchBarAction {
  label: string;
  icon?: BitwardenIcon;
  handler: FunctionReturningAwaitable;
  inactive?: boolean;
  inactiveReason?: string;
}

@Component({
  selector: "bit-batch-bar",
  templateUrl: "./batch-bar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitActionDirective,
    BitIconButtonComponent,
    ButtonComponent,
    IconComponent,
    MenuComponent,
    MenuItemComponent,
    MenuTriggerForDirective,
    TooltipDirective,
  ],
})
export class BatchBarComponent {
  readonly selectedCount = input.required<number>();
  readonly actions = input<BatchBarAction[]>([]);
  readonly menuActions = input<BatchBarAction[]>([]);
  readonly overflowButton = input<boolean>();
  readonly cleared = output<void>();

  protected readonly visible = computed(() => this.selectedCount() > 0);
  protected readonly showOverflow = computed(() => {
    const explicit = this.overflowButton();
    return explicit !== undefined ? explicit : this.menuActions().length > 0;
  });

  protected readonly onClear: FunctionReturningAwaitable = () => {
    this.cleared.emit();
  };

  protected callHandler(handler: FunctionReturningAwaitable): void {
    void handler();
  }

  @HostListener("keydown.escape", ["$event"])
  protected onEscape(event: KeyboardEvent): void {
    event.stopPropagation();
    this.cleared.emit();
  }
}
