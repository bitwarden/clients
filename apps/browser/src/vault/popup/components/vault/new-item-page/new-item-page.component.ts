import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { DialogService } from "@bitwarden/components";
import {
  AddEditFolderDialogComponent,
  AddEditFolderDialogResult,
  AddItemGridComponent,
  AddItemGridResult,
} from "@bitwarden/vault";

import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";
import { AddEditQueryParams } from "../add-edit/add-edit.component";

@Component({
  selector: "vault-new-item-page",
  templateUrl: "./new-item-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    AddItemGridComponent,
  ],
})
export class NewItemPageComponent {
  protected readonly folderId = toSignal<string | undefined>(
    this.route.queryParams.pipe(switchMap(async (p) => p["folderId"])),
    { initialValue: undefined },
  );

  protected readonly organizationId = toSignal<OrganizationId | undefined>(
    this.route.queryParams.pipe(switchMap(async (p) => p["organizationId"])),
    { initialValue: undefined },
  );

  protected readonly collectionId = toSignal<CollectionId | undefined>(
    this.route.queryParams.pipe(switchMap(async (p) => p["collectionId"])),
    { initialValue: undefined },
  );

  /**
   * Whether a cipher can be created for the organization referenced by `organizationId`.
   * `false` when the target organization is suspended, since items cannot be saved to it.
   */
  protected readonly canCreateCipher = toSignal(
    combineLatest([
      this.accountService.activeAccount$.pipe(getUserId),
      this.route.queryParams.pipe(switchMap(async (p) => p["organizationId"] as OrganizationId)),
    ]).pipe(
      switchMap(([userId, organizationId]) =>
        this.organizationService.organizations$(userId).pipe(
          map((organizations) => {
            if (!organizationId) {
              return true;
            }
            const organization = organizations.find((o) => o.id === organizationId);
            return !organization || organization.enabled;
          }),
        ),
      ),
    ),
    { initialValue: true },
  );

  constructor(
    private readonly dialogService: DialogService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly organizationService: OrganizationService,
    private readonly accountService: AccountService,
  ) {}

  protected async onItemSelected(item: AddItemGridResult): Promise<void> {
    if (item.result === AddItemGridResult.Folder) {
      const dialogRef = AddEditFolderDialogComponent.open(this.dialogService);
      const result = await firstValueFrom(dialogRef.closed);
      if (result === AddEditFolderDialogResult.Created) {
        void this.router.navigate(["/vault"]);
      }
      return;
    }

    if (item.result !== AddItemGridResult.Cipher) {
      return;
    }

    if (!this.canCreateCipher()) {
      // The organization is suspended and cannot have new items saved to it.
      return;
    }

    const poppedOut = BrowserPopupUtils.inPopout(window);

    const queryParams: AddEditQueryParams = {
      type: item.cipherType.toString(),
      folderId: this.folderId(),
      organizationId: this.organizationId(),
      collectionId: this.collectionId(),
    };

    if (!poppedOut && item.cipherType === CipherType.Login) {
      queryParams.prefillNameAndURIFromTab = "true";
    }

    void this.router.navigate(["/add-cipher"], { queryParams });
  }
}
