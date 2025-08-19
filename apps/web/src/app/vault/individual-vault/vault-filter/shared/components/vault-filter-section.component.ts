// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, InjectionToken, Injector, Input, OnDestroy, OnInit } from "@angular/core";
import { firstValueFrom, Observable, Subject, takeUntil } from "rxjs";
import { map } from "rxjs/operators";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ITreeNodeObject, TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { VaultFilterService } from "../../services/abstractions/vault-filter.service";
import { VaultFilterSection, VaultFilterType } from "../models/vault-filter-section.type";
import { VaultFilter } from "../models/vault-filter.model";

@Component({
  selector: "app-filter-section",
  templateUrl: "vault-filter-section.component.html",
  standalone: false,
})
export class VaultFilterSectionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private activeUserId$ = getUserId(this.accountService.activeAccount$);

  @Input() activeFilter: VaultFilter;
  @Input() section: VaultFilterSection;

  data: TreeNode<VaultFilterType>;
  collapsedFilterNodes: Set<string> = new Set();

  private injectors = new Map<string, Injector>();

  constructor(
    private vaultFilterService: VaultFilterService,
    private injector: Injector,
    private accountService: AccountService,
  ) {
    this.vaultFilterService.collapsedFilterNodes$
      .pipe(takeUntil(this.destroy$))
      .subscribe((nodes) => {
        this.collapsedFilterNodes = nodes;
      });
  }

  async ngOnInit() {
    this.section?.data$?.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.data = data;
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get headerNode() {
    return this.data;
  }

  get headerInfo() {
    return this.section.header;
  }

  get filters() {
    return this.data?.children;
  }

  get isOrganizationFilter() {
    return this.data.node instanceof Organization;
  }

  get isAllVaultsSelected() {
    return this.isOrganizationFilter && !this.activeFilter.selectedOrganizationNode;
  }

  isNodeSelected(filterNode: TreeNode<VaultFilterType>) {
    const { organizationId, cipherTypeId, folderId, collectionId, isCollectionSelected } =
      this.activeFilter;

    const collectionStatus =
      filterNode?.node.id === "AllCollections" &&
      (isCollectionSelected || collectionId === "AllCollections");

    return (
      organizationId === filterNode?.node.id ||
      cipherTypeId === filterNode?.node.id ||
      folderId === filterNode?.node.id ||
      collectionStatus
    );
  }

  async onFilterSelect(filterNode: TreeNode<VaultFilterType>) {
    await this.section?.action(filterNode);
  }

  get editInfo() {
    return this.section?.edit;
  }

  onEdit(filterNode: TreeNode<VaultFilterType>) {
    this.section?.edit?.action(filterNode.node);
  }

  get addInfo() {
    return this.section.add;
  }

  get showAddLink() {
    return this.section.add && this.section.add.route;
  }

  async onAdd() {
    this.section?.add?.action();
  }

  get optionsInfo() {
    return this.section?.options;
  }

  get divider() {
    return this.section?.divider;
  }

  isCollapsed(node: ITreeNodeObject) {
    return this.collapsedFilterNodes.has(node.id);
  }

  async toggleCollapse(node: ITreeNodeObject) {
    if (this.collapsedFilterNodes.has(node.id)) {
      this.collapsedFilterNodes.delete(node.id);
    } else {
      this.collapsedFilterNodes.add(node.id);
    }
    const userId = await firstValueFrom(this.activeUserId$);
    await this.vaultFilterService.setCollapsedFilterNodes(this.collapsedFilterNodes, userId);
  }

  // an injector is necessary to pass data into a dynamic component
  // here we are creating a new injector for each filter that has options
  createInjector(data: VaultFilterType) {
    let inject = this.injectors.get(data.id);

    if (!inject) {
      // Pass an observable to the component in order to update the component when the data changes
      // as data binding does not work with dynamic components in Angular 15 (inputs are supported starting Angular 16)
      const data$ = this.section.data$.pipe(
        map((sectionNode) => sectionNode?.children?.find((node) => node.node.id === data.id)?.node),
      );
      inject = Injector.create({
        providers: [{ provide: OptionsInput, useValue: data$ }],
        parent: this.injector,
      });
      this.injectors.set(data.id, inject);
    }
    return inject;
  }
}
export const OptionsInput = new InjectionToken<Observable<VaultFilterType>>("OptionsInput");
