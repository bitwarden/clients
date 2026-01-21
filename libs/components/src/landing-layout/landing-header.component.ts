import {
  AfterContentChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
} from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { distinctUntilChanged, map } from "rxjs";

import { BitwardenLogo } from "@bitwarden/assets/svg";

import { IconModule } from "../icon";
import { SharedModule } from "../shared";

@Component({
  selector: "bit-landing-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-header.component.html",
  imports: [RouterModule, IconModule, SharedModule],
})
export class LandingHeaderComponent implements AfterContentChecked {
  readonly hideLogo = input<boolean>(false);
  protected logo = BitwardenLogo;
  protected readonly contentWrapper = viewChild<ElementRef>("contentWrapper");

  // Convert viewChild signal to observable and check for rendered content
  protected readonly hasContent$ = toObservable(this.contentWrapper).pipe(
    map(() => {
      // Detect actual rendered content by inspecting DOM nodes. Required because contentChildren()
      // queries before router-outlet renders, missing dynamically loaded content.
      const wrapper: HTMLElement = this.contentWrapper()?.nativeElement;
      return (
        wrapper &&
        wrapper.childNodes.length > 0 &&
        Array.from(wrapper.childNodes).some(
          (node: Node) =>
            node.nodeType === Node.ELEMENT_NODE ||
            (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()),
        )
      );
    }),
    distinctUntilChanged(),
  );

  ngAfterContentChecked() {
    // Trigger observable emission by accessing the signal
    this.contentWrapper();
  }
}
