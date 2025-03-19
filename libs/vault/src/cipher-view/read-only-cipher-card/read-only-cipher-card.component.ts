import { AfterViewInit, Component, ContentChildren, QueryList } from "@angular/core";

import { CardComponent, BitFormFieldComponent } from "@bitwarden/components";

@Component({
  selector: "read-only-cipher-card",
  templateUrl: "./read-only-cipher-card.component.html",
  standalone: true,
  imports: [CardComponent],
})
/**
 * A thin wrapper around the `bit-card` component that disables the bottom border for the last form field.
 */
export class ReadOnlyCipherCardComponent implements AfterViewInit {
  @ContentChildren(BitFormFieldComponent) formFields?: QueryList<BitFormFieldComponent>;

  ngAfterViewInit(): void {
    // Disable the bottom border for the last form field
    if (this.formFields?.last) {
      // Delay model update until next change detection cycle
      setTimeout(() => {
        if (this.formFields) {
          this.formFields.last.disableReadOnlyBorder = true;
        }
      });
    }
  }
}
