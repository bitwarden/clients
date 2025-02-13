import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonComponent } from "@bitwarden/components";
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
  imports: [CommonModule, I18nPipe, ButtonComponent],
})
export class BrowserExtensionPromptComponent implements OnInit {
  /** Current state of the prompt page */
  protected pageState$ = this.browserExtensionPromptService.pageState$;

  /** All available page states */
  protected BrowserPromptState = BrowserPromptState;

  protected manualErrorMessage: SafeHtml = "";

  constructor(
    private browserExtensionPromptService: BrowserExtensionPromptService,
    private sanitizer: DomSanitizer,
    private i18nService: I18nService,
  ) {
    // The Bitwarden's icon is an SVG, and needs to bypass Angular's default sanitization.
    this.manualErrorMessage = this.sanitizer.bypassSecurityTrustHtml(
      this.i18nService.t("openExtensionManually", VaultIcons.BitwardenIcon.svg),
    );
  }

  ngOnInit(): void {
    this.browserExtensionPromptService.start();
  }

  openExtension(): void {
    this.browserExtensionPromptService.openExtension();
  }
}
