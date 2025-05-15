// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { AccessTokenView } from "../models/view/access-token.view";

@Component({
  selector: "sm-access-list",
  templateUrl: "./access-list.component.html",
  standalone: false,
})
export class AccessListComponent {
  @Input()
  get tokens(): AccessTokenView[] {
    return this._tokens;
  }
  set tokens(secrets: AccessTokenView[]) {
    this.selection.clear();
    this._tokens = secrets;
  }
  private _tokens: AccessTokenView[];

  @Output() newAccessTokenEvent = new EventEmitter();
  @Output() revokeAccessTokensEvent = new EventEmitter<AccessTokenView[]>();

  protected selection = new SelectionModel<string>(true, []);

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.tokens.length;
    return numSelected === numRows;
  }

  toggleAll() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.selection.select(...this.tokens.map((s) => s.id));
  }

  protected revokeSelected() {
    const selected = this.tokens.filter((s) => this.selection.selected.includes(s.id));
    this.revokeAccessTokensEvent.emit(selected);
  }
}
