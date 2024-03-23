import { Directive, EventEmitter, Input, Output } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { DynamicTreeNode } from "../models/dynamic-tree-node.model";
import { TopLevelTreeNode } from "../models/top-level-tree-node.model";
import { VaultFilter } from "../models/vault-filter.model";

@Directive()
export class FolderFilterComponent {
  @Input() hide = false;
  @Input() collapsedFilterNodes: Set<string>;
  @Input() folderNodes: DynamicTreeNode<FolderView>;
  @Input() activeFilter: VaultFilter;

  @Output() onNodeCollapseStateChange: EventEmitter<ITreeNodeObject> =
    new EventEmitter<ITreeNodeObject>();
  @Output() onFilterChange: EventEmitter<VaultFilter> = new EventEmitter<VaultFilter>();
  @Output() onAddFolder = new EventEmitter();
  @Output() onEditFolder = new EventEmitter<FolderView>();
  organization: Organization;
  folderOnDrag: string = "";

  protected flexibleCollectionsV1Enabled = false;

  constructor(
    protected cipherService: CipherService,
    protected logService: LogService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected messagingService: MessagingService,
    protected configService: ConfigServiceAbstraction,
  ) {}

  get folders() {
    return this.folderNodes?.fullList;
  }

  get nestedFolders() {
    return this.folderNodes?.nestedList;
  }

  readonly foldersGrouping: TopLevelTreeNode = {
    id: "folders",
    name: "folders",
  };

  async ngOnInit() {
    this.flexibleCollectionsV1Enabled = await this.configService.getFeatureFlag(
      FeatureFlag.FlexibleCollectionsV1,
      false,
    );
  }

  applyFilter(folder: FolderView) {
    this.activeFilter.resetFilter();
    this.activeFilter.selectedFolder = true;
    this.activeFilter.selectedFolderId = folder.id;
    this.onFilterChange.emit(this.activeFilter);
  }

  addFolder() {
    this.onAddFolder.emit();
  }

  editFolder(folder: FolderView) {
    this.onEditFolder.emit(folder);
  }

  isCollapsed(node: ITreeNodeObject) {
    return this.collapsedFilterNodes.has(node.id);
  }

  async toggleCollapse(node: ITreeNodeObject) {
    this.onNodeCollapseStateChange.emit(node);
  }

  onDragleave(folderId: string) {
    if (this.folderOnDrag != folderId) {
      return;
    }
    this.folderOnDrag = "";
  }

  onDragenter(folderId: string) {
    this.folderOnDrag = folderId;
  }

  async onDrop({ dataTransfer }: DragEvent, node: FolderView) {
    const chipherId = dataTransfer.getData("cipherId");
    if (chipherId.length == 0) {
      return;
    }

    const cipher = await this.cipherService.get(chipherId);
    if (cipher == null) {
      return;
    }

    const decryptCipher = await cipher.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipher),
    );

    if (decryptCipher.folderId == node.id) {
      return;
    }
    decryptCipher.folderId = node.id;

    const encryptCipher = await this.cipherService.encrypt(decryptCipher);

    try {
      await this.saveCipher(encryptCipher);
      this.platformUtilsService.showToast("success", null, this.i18nService.t("editedItem"));
      this.messagingService.send("refreshCiphers");
      this.folderOnDrag = "";
      return true;
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected saveCipher(cipher: Cipher) {
    let orgAdmin = this.organization?.isAdmin;

    if (this.flexibleCollectionsV1Enabled) {
      // Flexible Collections V1 restricts admins, check the organization setting via canEditAllCiphers
      orgAdmin = this.organization?.canEditAllCiphers(true);
    }

    return this.cipherService.updateWithServer(cipher, orgAdmin, true);
  }
}
