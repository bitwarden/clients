import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { BitwardenIcon, BrowserExtensionIcon, Party } from "@bitwarden/assets/svg";
import { ButtonModule, SpinnerComponent, SvgModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** What the page shows: it is opening the popup, it opened, or it could not and offers a button,
 *  then the toolbar instructions. */
export type ExtensionPhase = "opening" | "opened" | "button" | "toolbar";

/** The cards the import tab shows while it brings the extension popup forward. */
@Component({
  selector: "app-import-confirmation-states",
  templateUrl: "import-confirmation-states.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, I18nPipe, SpinnerComponent, SvgModule, TypographyModule],
  host: { class: "tw-flex tw-w-96 tw-flex-col tw-gap-6", "aria-live": "polite" },
})
export class ImportConfirmationStatesComponent {
  readonly phase = input.required<ExtensionPhase>();
  /** How many items were imported, for the title while the popup opens. */
  readonly total = input.required<number>();
  /** Whether the Open extension button is waiting on another try. */
  readonly retrying = input(false);
  /** The user asked to try opening the popup again. */
  readonly openExtension = output<void>();

  protected readonly celebration = Party;
  protected readonly extensionIllustration = BrowserExtensionIcon;
  protected readonly toolbarIcon = BitwardenIcon;
}
