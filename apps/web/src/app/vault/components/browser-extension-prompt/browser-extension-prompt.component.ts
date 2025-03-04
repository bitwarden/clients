import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";

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
export class BrowserExtensionPromptComponent implements OnInit {
  /** Current state of the prompt page */
  protected pageState$ = this.browserExtensionPromptService.pageState$;

  /** All available page states */
  protected BrowserPromptState = BrowserPromptState;

  protected BitwardenIcon = VaultIcons.BitwardenIcon;

  constructor(private browserExtensionPromptService: BrowserExtensionPromptService) {}

  ngOnInit(): void {
    this.browserExtensionPromptService.start();
  }

  openExtension(): void {
    this.browserExtensionPromptService.openExtension();
  }
}
