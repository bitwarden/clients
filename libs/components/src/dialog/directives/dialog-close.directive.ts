import { DialogRef } from "@angular/cdk/dialog";
import { Directive, HostBinding, HostListener, Optional, input } from "@angular/core";

import { ModalRef } from "@bitwarden/angular/components/modal/modal.ref";

@Directive({ selector: "[bitDialogClose]" })
export class DialogCloseDirective {
  readonly dialogResult = input<any>(undefined, { alias: "bitDialogClose" });

  constructor(
    @Optional() private dialogRef: DialogRef<any>,
    @Optional() private modalRef: ModalRef,
  ) {}

  @HostBinding("attr.disabled")
  get disableClose() {
    return this.dialogRef?.disableClose ? true : null;
  }

  @HostListener("click")
  close(): void {
    if (this.disableClose) {
      return;
    }
    const result = this.dialogResult?.();
    if (this.dialogRef) {
      this.dialogRef.close(result);
      return;
    }
    if (this.modalRef) {
      this.modalRef.close?.(result);
      return;
    }
  }
}
