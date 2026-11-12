import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "bit-section",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      [class]="
        disableMargin()
          ? ''
          : 'tw-mb-5 bit-compact:tw-mb-4 [&:not(bit-dialog_*):not(popup-page_*)]:md:tw-mb-12'
      "
    >
      <ng-content></ng-content>
    </section>
  `,
})
export class SectionComponent {
  readonly disableMargin = input(false, { transform: coerceBooleanProperty });
}
