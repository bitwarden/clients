import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { BehaviorSubject } from "rxjs";

import { AnonLayoutWrapperDataService } from "@bitwarden/auth/angular";
import { I18nPipe } from "@bitwarden/ui-common";

enum BrowserPromptState {
  Loading = "loading",
  Error = "error",
  Success = "success",
}

@Component({
  selector: "vault-browser-extension-prompt",
  templateUrl: "./browser-extension-prompt.component.html",
  standalone: true,
  imports: [CommonModule, I18nPipe],
})
export class BrowserExtensionPromptComponent {
  protected pageState$ = new BehaviorSubject<BrowserPromptState>(BrowserPromptState.Loading);
  protected BrowserPromptState = BrowserPromptState;

  constructor(private anonLayoutWrapperDataService: AnonLayoutWrapperDataService) {}
}
