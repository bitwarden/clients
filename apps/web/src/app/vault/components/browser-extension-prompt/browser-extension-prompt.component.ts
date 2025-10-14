import { CommonModule, DOCUMENT } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map, Observable, of, tap } from "rxjs";

import { ExtensionPageUrls } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";
import { ButtonComponent, IconModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  BrowserExtensionPromptService,
  BrowserPromptState,
} from "../../services/browser-extension-prompt.service";
import { ManuallyOpenExtensionComponent } from "../manually-open-extension/manually-open-extension.component";

@Component({
  selector: "vault-browser-extension-prompt",
  templateUrl: "./browser-extension-prompt.component.html",
  imports: [CommonModule, I18nPipe, ButtonComponent, IconModule, ManuallyOpenExtensionComponent],
})
export class BrowserExtensionPromptComponent implements OnInit, OnDestroy {
  protected VaultMessages = VaultMessages;
  protected ExtensionPageUrls = ExtensionPageUrls;

  /** Current state of the prompt page */
  protected pageState$ = this.browserExtensionPromptService.pageState$;

  /** All available page states */
  protected BrowserPromptState = BrowserPromptState;

  /** Content of the meta[name="viewport"] element */
  private viewportContent: string | null = null;

  protected extensionPage$: Observable<string> = of(VaultMessages.OpenAtRiskPasswords);

  constructor(
    private browserExtensionPromptService: BrowserExtensionPromptService,
    private route: ActivatedRoute,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.extensionPage$ = this.route.queryParamMap.pipe(
      map((params) => params.get("url") ?? VaultMessages.OpenAtRiskPasswords),
    );

    this.extensionPage$
      .pipe(
        tap((url) => this.browserExtensionPromptService.registerPopupUrl(url)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  ngOnInit(): void {
    this.browserExtensionPromptService.start();
    // It is not be uncommon for users to hit this page from a mobile device.
    // There are global styles and the viewport meta tag that set a min-width
    // for the page which cause it to render poorly. Remove them here.
    // https://github.com/bitwarden/clients/blob/main/apps/web/src/scss/base.scss#L6
    this.document.body.style.minWidth = "auto";

    const viewportMeta = this.document.querySelector('meta[name="viewport"]');

    // Save the current viewport content to reset it when the component is destroyed
    this.viewportContent = viewportMeta?.getAttribute("content") ?? null;
    viewportMeta?.setAttribute("content", "width=device-width, initial-scale=1.0");
  }

  ngOnDestroy(): void {
    // Reset the body min-width when the component is destroyed
    this.document.body.style.minWidth = "";

    if (this.viewportContent !== null) {
      this.document
        .querySelector('meta[name="viewport"]')
        ?.setAttribute("content", this.viewportContent);
    }
  }

  async openExtension(command: string) {
    await this.browserExtensionPromptService.openExtension(command, true);
  }
}
