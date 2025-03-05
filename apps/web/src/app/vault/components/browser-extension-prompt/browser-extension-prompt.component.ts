import { CommonModule, DOCUMENT } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";

import { ButtonComponent, IconModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultIcons } from "@bitwarden/vault";

import {
  BrowserExtensionPromptService,
  BrowserPromptState,
} from "../../services/browser-extension-prompt.service";

@Component({
  selector: "vault-browser-extension-prompt",
  templateUrl: "./browser-extension-prompt.component.html",
  standalone: true,
  imports: [CommonModule, I18nPipe, ButtonComponent, IconModule],
})
export class BrowserExtensionPromptComponent implements OnInit, OnDestroy {
  /** Current state of the prompt page */
  protected pageState$ = this.browserExtensionPromptService.pageState$;

  /** All available page states */
  protected BrowserPromptState = BrowserPromptState;

  protected BitwardenIcon = VaultIcons.BitwardenIcon;

  constructor(
    private browserExtensionPromptService: BrowserExtensionPromptService,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  ngOnInit(): void {
    this.browserExtensionPromptService.start();

    // It is not be uncommon for users to hit this page from a mobile device.
    // There are global styles that set a min-width on the body which cause
    // the page to render poorly. Remove them here.
    // https://github.com/bitwarden/clients/blob/main/apps/web/src/scss/base.scss#L6
    this.document.body.style.minWidth = "auto";
  }

  ngOnDestroy(): void {
    // Reset the body min-width when the component is destroyed
    this.document.body.style.minWidth = "";
  }

  openExtension(): void {
    this.browserExtensionPromptService.openExtension();
  }
}
