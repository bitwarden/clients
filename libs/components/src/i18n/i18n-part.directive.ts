import { Directive } from "@angular/core";

/**
 * Structural directive that can be used to mark a template reference inside an I18nComponent.
 * @example
 * // The following would render a link to the policies page with translated text.
 * <a routerLink="../policies" *bit-i18n-part="let text">{{text}}</a>
 */
@Directive({
  selector: "[bit-i18n-part]",
})
export class I18nPartDirective {}
