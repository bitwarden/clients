import { DialogRef } from "@angular/cdk/dialog";
import { Directive, HostListener, Input, Optional } from "@angular/core";

@Directive({
  selector: "[bitDialogClose]",
})
export class DialogCloseDirective {
  @Input("bitDialogClose") dialogResult: any;

  constructor(@Optional() public dialogRef: DialogRef) {}

  @HostListener("click") close(): void {
    this.dialogRef.close(this.dialogResult);
  }
}
