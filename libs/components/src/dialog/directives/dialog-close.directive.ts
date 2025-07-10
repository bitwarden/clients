import { DialogRef } from "@angular/cdk/dialog";
import { Directive, HostBinding, HostListener, Input, Optional } from "@angular/core";

@Directive({
  selector: "[bitDialogClose]",
})
export class DialogCloseDirective {
  @Input("bitDialogClose") dialogResult: any;

  constructor(@Optional() public dialogRef: DialogRef) {}

  @HostBinding("attr.disabled")
  get disableClose() {
    return this.dialogRef?.disableClose ? true : null;
  }

  @HostListener("click")
  close(): void {
    if (this.disableClose) {
      return;
    }

    this.dialogRef.close(this.dialogResult);
  }
}
