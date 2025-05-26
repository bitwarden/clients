import { CdkTextareaAutosize, TextFieldModule } from "@angular/cdk/text-field";
import { AfterViewInit, Directive, Host, NgZone } from "@angular/core";
import { firstValueFrom } from "rxjs";

@Directive({
  standalone: true,
  selector: "textarea[vaultAutosizeReadOnlyTextArea]",
  providers: [TextFieldModule],
  hostDirectives: [CdkTextareaAutosize],
})
export class VaultAutosizeReadOnlyTextArea implements AfterViewInit {
  constructor(
    @Host() private autosize: CdkTextareaAutosize,
    private ngZone: NgZone,
  ) {
    // initially disable autosize
    this.autosize.enabled = false;
  }

  // <textarea>s are commonly used within `bit-form-field` components which render
  // content within templates. This causes the `CdkTextareaAutosize` to error out
  // when trying to access the `parentNode` of the textarea. To avoid this, wait
  // for the next change detection cycle to enable the autosize directive.
  async ngAfterViewInit(): Promise<void> {
    await firstValueFrom(this.ngZone.onStable);

    this.autosize.enabled = true;
  }
}
