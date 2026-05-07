import { Directive, HostBinding, HostListener, Optional, input } from "@angular/core";

import { DialogRef } from "../dialog.service";

@Directive({
  selector: "[bitDialogClose]",
})
export class DialogCloseDirective {
  // When used as a bare attribute (`bitDialogClose` with no value), Angular binds the empty
  // string "". Normalize that to undefined so close() callers can't accidentally distinguish
  // bare-attribute use from an explicit undefined binding.
  readonly dialogResult = input<any, any>(undefined, {
    alias: "bitDialogClose",
    transform: (v: any) => (v === "" ? undefined : v),
  });

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

    void this.dialogRef.close(this.dialogResult());
  }
}
