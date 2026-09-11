import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, filter, map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoFolders } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  ItemModule,
  StatusLockupComponent,
  SvgComponent,
} from "@bitwarden/components";
import { AddEditFolderDialogComponent, Vfo1I18nPipe } from "@bitwarden/vault";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./folders.component.html",
  imports: [
    CommonModule,
    JslibModule,
    PopOutComponent,
    PopupPageComponent,
    PopupHeaderComponent,
    ItemModule,
    StatusLockupComponent,
    IconButtonModule,
    ButtonModule,
    AsyncActionsModule,
    Vfo1I18nPipe,
    SvgComponent,
  ],
})
export class FoldersComponent {
  folders$: Observable<FolderView[]>;

  NoFoldersIcon = NoFolders;
  private activeUserId$ = this.accountService.activeAccount$.pipe(map((a) => a?.id));
  private configService = inject(ConfigService);

  /** When enabled, the id-less "My Folder" placeholder is filtered out of the folder list. */
  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  constructor(
    private folderService: FolderService,
    private dialogService: DialogService,
    private accountService: AccountService,
  ) {
    this.folders$ = combineLatest([
      this.activeUserId$.pipe(
        filter((userId): userId is UserId => userId !== null),
        switchMap((userId) => this.folderService.folderViews$(userId)),
      ),
      this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    ]).pipe(map(([folders, vfo1]) => (vfo1 ? folders.filter((folder) => folder.id) : folders)));
  }

  /** Open the Add/Edit folder dialog */
  openAddEditFolderDialog(folder?: FolderView) {
    // If a folder is provided, the edit variant should be shown
    const editFolderConfig = folder ? { folder } : undefined;

    AddEditFolderDialogComponent.open(this.dialogService, { editFolderConfig });
  }
}
