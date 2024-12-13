import { Component } from "@angular/core";

import { A11yCellDirective } from "../a11y/a11y-cell.directive";

@Component({
  selector: "bit-item-action",
  standalone: true,
  template: `<ng-content></ng-content>`,
  providers: [{ provide: A11yCellDirective, useExisting: ItemActionComponent }],
})
export class ItemActionComponent extends A11yCellDirective {}
