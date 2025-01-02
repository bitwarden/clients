// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { Directive, HostBinding, Input } from "@angular/core";

type TypographyType = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "body1" | "body2" | "helper";

const styles: Record<TypographyType, string[]> = {
  h1: ["!tw-text-3xl", "tw-font-semibold", "tw-text-main"],
  h2: ["!tw-text-2xl", "tw-font-semibold", "tw-text-main"],
  h3: ["!tw-text-xl", "tw-font-semibold", "tw-text-main"],
  h4: ["!tw-text-lg", "tw-font-semibold", "tw-text-main"],
  h5: ["!tw-text-base", "tw-font-bold", "tw-text-main"],
  h6: ["!tw-text-sm", "tw-font-bold", "tw-text-main"],
  body1: ["!tw-text-base"],
  body2: ["!tw-text-sm"],
  helper: ["!tw-text-xs"],
};

const margins: Record<TypographyType, string[]> = {
  h1: ["tw-mb-2"],
  h2: ["tw-mb-2"],
  h3: ["tw-mb-2"],
  h4: ["tw-mb-2"],
  h5: ["tw-mb-1.5"],
  h6: ["tw-mb-1.5"],
  body1: [],
  body2: [],
  helper: [],
};

@Directive({
  selector: "[bitTypography]",
  standalone: true,
})
export class TypographyDirective {
  @Input("bitTypography") bitTypography: TypographyType;

  private _margin = true;
  @Input()
  set noMargin(value: boolean | "") {
    this._margin = !coerceBooleanProperty(value);
  }

  @HostBinding("class") get classList() {
    return styles[this.bitTypography].concat(this._margin ? margins[this.bitTypography] : []);
  }
}
