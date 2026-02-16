import {
  Component,
  ChangeDetectionStrategy,
  AfterViewInit,
  viewChild,
  ElementRef,
} from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { InfoFilledIcon } from "@bitwarden/assets/svg";
import { PopoverModule, IconModule, ButtonModule, SvgModule } from "@bitwarden/components";

@Component({
  selector: "app-simplified-autofill-info",
  templateUrl: "./simplified-autofill-info.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, PopoverModule, IconModule, ButtonModule, SvgModule],
})
export class SimplifiedAutofillInfoComponent implements AfterViewInit {
  readonly pingElement = viewChild<ElementRef<HTMLSpanElement>>("pingElement");
  protected readonly InfoFilledIcon = InfoFilledIcon;

  ngAfterViewInit(): void {
    const pingElement = this.pingElement().nativeElement;
    const animation = pingElement
      .getAnimations()
      .find((a) => "animationName" in a && a.animationName === "tw-ping");

    if (animation) {
      animation.onfinish = () => {
        pingElement.hidden = true;
      };
    }
  }
}
