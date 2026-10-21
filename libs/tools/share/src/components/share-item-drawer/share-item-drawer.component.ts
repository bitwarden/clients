import { ChangeDetectionStrategy, Component, inject, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  IconModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ShareItemFormComponent } from "../share-item-form/share-item-form.component";

export interface ShareItemDrawerData {
  cipher: CipherView;
}

@Component({
  selector: "app-share-item-drawer",
  templateUrl: "share-item-drawer.component.html",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogModule,
    ButtonModule,
    I18nPipe,
    ShareItemFormComponent,
    IconModule,
    AsyncActionsModule,
  ],
})
export class ShareItemDrawerComponent {
  private readonly dialogRef = inject(DialogRef);
  protected readonly data: ShareItemDrawerData = inject(DIALOG_DATA);
  protected readonly shareItemForm = viewChild.required(ShareItemFormComponent);

  constructor() {
    // Path changes are handled by `closeOnNavigation`, but the vaults select an item through the
    // query string alone. Close once another item is selected so the drawer does not linger beside
    // it. Opening from an item's own dialog clears these params as that dialog closes, so it does
    // not trip this.
    const router = inject(Router);
    router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        filter((event) => {
          const params = router.parseUrl(event.urlAfterRedirects).queryParamMap;
          return params.has("itemId") || params.has("cipherId");
        }),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.close());
  }

  protected readonly createAndCopyLink = async () => {
    await this.shareItemForm().createAndCopyLink();
  };

  protected async close(): Promise<void> {
    await this.dialogRef.close();
  }
}
