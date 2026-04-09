import { Directive } from "@angular/core";

/**
 * Marker directive for the banner title slot. Apply to any element projected into `bit-banner`
 * to occupy the title position. Its presence is also used to conditionally render the actions slot.
 *
 * @example
 * ```html
 * <bit-banner>
 *   <span bitBannerTitle>Title text</span>
 * </bit-banner>
 * ```
 */
@Directive({
  selector: "[bitBannerTitle]",
  standalone: true,
})
export class BannerTitleDirective {}
