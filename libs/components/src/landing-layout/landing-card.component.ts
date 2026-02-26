import { ChangeDetectionStrategy, Component } from "@angular/core";

import { BaseCardComponent } from "../card";

/**
 * Card component for landing pages that wraps content in a styled container.
 *
 * @remarks
 * This component provides:
 * - Card-based layout with consistent styling
 * - Content projection for forms, text, or other content
 * - Proper elevation and border styling
 *
 * Use this component inside `bit-landing-content` to wrap forms, content sections,
 * or any content that should appear in a contained, elevated card.
 *
 * @example
 * ```html
 * <bit-landing-card>
 *   <form>
 *     <!-- Your form fields here -->
 *   </form>
 * </bit-landing-card>
 * ```
 */
@Component({
  selector: "bit-landing-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseCardComponent],
  templateUrl: "./landing-card.component.html",
})
export class LandingCardComponent {}
