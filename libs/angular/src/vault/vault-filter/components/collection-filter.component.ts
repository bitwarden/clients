import { Directive, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { Observable, Subject, firstValueFrom, map, takeUntil } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { DialogService } from "@bitwarden/components";

import { DynamicTreeNode } from "../models/dynamic-tree-node.model";
import { TopLevelTreeNode } from "../models/top-level-tree-node.model";
import { VaultFilter } from "../models/vault-filter.model";

@Directive()
export class CollectionFilterComponent implements OnInit, OnDestroy {
  @Input() hide = false;
  @Input() collapsedFilterNodes: Set<string>;
  @Input() collectionNodes: DynamicTreeNode<CollectionView>;
  @Input() activeFilter: VaultFilter;

  @Output() onNodeCollapseStateChange: EventEmitter<ITreeNodeObject> =
    new EventEmitter<ITreeNodeObject>();
  @Output() onFilterChange: EventEmitter<VaultFilter> = new EventEmitter<VaultFilter>();

  formPromise: Promise<void>;
  collectionOnDrag: string = "";
  organizations$: Observable<Organization[]>;
  organizationId: string;

  private _destroy = new Subject<void>();

  constructor(
    private dialogService: DialogService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private cipherService: CipherService,
    private logService: LogService,
    private organizationService: OrganizationService,
    private messagingService: MessagingService,
  ) {}
  ngOnInit(): void {
    this.organizations$ = this.organizationService.memberOrganizations$.pipe(
      map((orgs) => {
        return orgs
          .filter((o) => o.enabled && o.status === OrganizationUserStatusType.Confirmed)
          .sort(Utils.getSortFunction(this.i18nService, "name"));
      }),
    );

    this.organizations$.pipe(takeUntil(this._destroy)).subscribe((orgs) => {
      if (this.organizationId == null && orgs.length > 0) {
        this.organizationId = orgs[0].id;
      }
    });
  }
  ngOnDestroy(): void {
    this._destroy.next();
    this._destroy.complete();
  }

  readonly collectionsGrouping: TopLevelTreeNode = {
    id: "collections",
    name: "collections",
  };

  get collections() {
    return this.collectionNodes?.fullList;
  }

  get nestedCollections() {
    return this.collectionNodes?.nestedList;
  }

  get show() {
    return !this.hide && this.collections != null && this.collections.length > 0;
  }

  isCollapsed(node: ITreeNodeObject) {
    return this.collapsedFilterNodes.has(node.id);
  }

  applyFilter(collection: CollectionView) {
    this.activeFilter.resetFilter();
    this.activeFilter.selectedCollection = true;
    this.activeFilter.selectedCollectionId = collection.id;
    this.onFilterChange.emit(this.activeFilter);
  }

  async toggleCollapse(node: ITreeNodeObject) {
    this.onNodeCollapseStateChange.emit(node);
  }

  onDragleave(collectionId: string) {
    if (this.collectionOnDrag != collectionId) {
      return;
    }
    this.collectionOnDrag = "";
  }

  onDragenter(collectionId: string) {
    this.collectionOnDrag = collectionId;
  }

  async onDrop({ dataTransfer }: DragEvent, node: CollectionView) {
    this.collectionOnDrag = "";
    const chipherId = dataTransfer.getData("cipherId");
    if (chipherId.length == 0) {
      return;
    }
    const cipherDomain = await this.cipherService.get(chipherId);
    if (cipherDomain == null || cipherDomain.collectionIds.includes(node.id)) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "moveItem" },
      content: { key: "moveToOrgConfirm" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    const cipherView = await cipherDomain.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipherDomain),
    );

    const orgs = await firstValueFrom(this.organizations$);
    const orgName =
      orgs.find((o) => o.id === this.organizationId)?.name ?? this.i18nService.t("organization");

    try {
      this.formPromise = this.cipherService
        .shareWithServer(cipherView, this.organizationId, [node.id])
        .then(async () => {
          this.messagingService.send("refreshCiphers");
          this.platformUtilsService.showToast(
            "success",
            null,
            this.i18nService.t("movedItemToOrg", cipherView.name, orgName),
          );
        });
      await this.formPromise;
      return true;
    } catch (e) {
      this.logService.error(e);
    }
    return false;
  }
}
