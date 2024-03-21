import { Directive, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";

@Directive()
export class CollectionsComponent implements OnInit {
  @Input() cipherId: string;
  @Input() allowSelectNone = false;
  @Output() onSavedCollections = new EventEmitter();

  formPromise: Promise<any>;
  cipher: CipherView;
  collectionIds: string[];
  collections: CollectionView[] = [];

  protected cipherDomain: Cipher;

  constructor(
    protected collectionService: CollectionService,
    protected platformUtilsService: PlatformUtilsService,
    protected i18nService: I18nService,
    protected cipherService: CipherService,
    private logService: LogService,
  ) {}

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.cipherDomain = await this.loadCipher();
    this.collectionIds = this.loadCipherCollections();
    this.cipher = await this.cipherDomain.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(this.cipherDomain),
    );
    this.collections = await this.loadCollections();

    this.collections.forEach((c) => ((c as any).checked = false));
    if (this.collectionIds != null) {
      this.collections.forEach((c) => {
        (c as any).checked = this.collectionIds != null && this.collectionIds.indexOf(c.id) > -1;
      });
    }
  }

  async submit(): Promise<boolean> {
    const selectedCollectionIds = this.collections
      .filter((c) => !!(c as any).checked)
      .map((c) => c.id);
    if (!this.allowSelectNone && selectedCollectionIds.length === 0) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectOneCollection"),
      );
      return false;
    }
    this.cipherDomain.collectionIds = selectedCollectionIds;
    try {
      this.formPromise = this.saveCollections();
      await this.formPromise;
      this.onSavedCollections.emit();
      this.platformUtilsService.showToast("success", null, this.i18nService.t("editedItem"));
      return true;
    } catch (e) {
      this.logService.error(e);
      return false;
    }
  }

  protected loadCipher() {
    return this.cipherService.get(this.cipherId);
  }

  protected loadCipherCollections() {
    return this.cipherDomain.collectionIds;
  }

  protected async loadCollections() {
    const allCollections = await this.collectionService.getAllDecrypted();
    return allCollections.filter(
      (c) => !c.readOnly && c.organizationId === this.cipher.organizationId,
    );
  }

  protected saveCollections() {
    return this.cipherService.saveCollectionsWithServer(this.cipherDomain);
  }
}
