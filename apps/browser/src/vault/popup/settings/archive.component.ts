import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, map, startWith } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DialogService,
  IconButtonModule,
  ItemModule,
  MenuModule,
  NoItemsModule,
  SectionComponent,
  SectionHeaderComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { CanDeleteCipherDirective, CipherArchiveService } from "@bitwarden/vault";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "archive.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    NoItemsModule,
    ItemModule,
    MenuModule,
    IconButtonModule,
    CanDeleteCipherDirective,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
  ],
})
export class ArchiveComponent {
  private dialogService = inject(DialogService);
  private router = inject(Router);
  private cipherService = inject(CipherService);
  private accountService = inject(AccountService);
  private logService = inject(LogService);
  private toastService = inject(ToastService);
  private i18nService = inject(I18nService);
  private cipherArchiveService = inject(CipherArchiveService);

  protected archivedCiphers$ = this.cipherArchiveService.archivedCiphers$;

  protected loading$ = this.archivedCiphers$.pipe(
    map(() => false),
    startWith(true),
  );

  async view(cipher: CipherView) {
    if (!(await this.cipherArchiveService.canInteract(cipher))) {
      return;
    }

    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: cipher.id, type: cipher.type },
    });
  }

  async edit(cipher: CipherView) {
    if (!(await this.cipherArchiveService.canInteract(cipher))) {
      return;
    }

    await this.router.navigate(["/edit-cipher"], {
      queryParams: { cipherId: cipher.id, type: cipher.type },
    });
  }

  async delete(cipher: CipherView) {
    if (!(await this.cipherArchiveService.canInteract(cipher))) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: { key: "deleteItemConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    try {
      await this.cipherService.softDeleteWithServer(cipher.id, activeUserId);
    } catch (e) {
      this.logService.error(e);
      return;
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("deletedItem"),
    });
  }

  async unarchive(cipher: CipherView) {
    if (!(await this.cipherArchiveService.canInteract(cipher))) {
      return;
    }
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    await this.cipherArchiveService.unarchiveWithServer(cipher.id as CipherId, activeUserId);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("itemRemovedFromArchive"),
    });
  }

  async clone(cipher: CipherView) {
    if (!(await this.cipherArchiveService.canInteract(cipher))) {
      return;
    }

    if (cipher.login?.hasFido2Credentials) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "passkeyNotCopied" },
        content: { key: "passkeyNotCopiedAlert" },
        type: "info",
      });

      if (!confirmed) {
        return;
      }
    }

    await this.router.navigate(["/clone-cipher"], {
      queryParams: {
        clone: true.toString(),
        cipherId: cipher.id,
        type: cipher.type,
      },
    });
  }
}
