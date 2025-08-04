import { DialogRef } from "@angular/cdk/dialog";
import { Directive, HostBinding, HostListener, Optional, input } from "@angular/core";

@Directive({
  selector: "[bitDialogClose]",
})
export class DialogCloseDirective {
  readonly dialogResult = input<any>(undefined, { alias: "bitDialogClose" });

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

    this.dialogRef.close(this.dialogResult());
  }
}
