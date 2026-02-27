import { CdkDialogContainer, DialogRef } from "@angular/cdk/dialog";
import { Directive, HostBinding, OnInit, Optional, input } from "@angular/core";

// Increments for each instance of this component
let nextId = 0;

@Directive({
  selector: "[bitDialogTitleContainer]",
})
export class DialogTitleContainerDirective implements OnInit {
  @HostBinding("id") id = `bit-dialog-title-${nextId++}`;

  readonly simple = input(false);

  constructor(@Optional() private dialogRef: DialogRef<any>) {}

  ngOnInit(): void {
    // Based on angular/components, licensed under MIT
    // https://github.com/angular/components/blob/14.2.0/src/material/dialog/dialog-content-directives.ts#L121-L128
    if (this.dialogRef) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Promise.resolve().then(() => {
        const container = this.dialogRef.containerInstance as CdkDialogContainer;

        if (container && container._ariaLabelledByQueue.length === 0) {
          container._ariaLabelledByQueue.push(this.id);
        }
      });
    }
  }
}
