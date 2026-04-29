// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, computed, inject, input, InjectionToken, Injector, Input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, Observable } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ITreeNodeObject, TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import {
  VaultFilterServiceAbstraction as VaultFilterService,
  VaultFilterSection,
  VaultFilterType,
  VaultFilter,
} from "@bitwarden/vault";

import { CoachmarkService } from "../../../../components/coachmark";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-filter-section",
  templateUrl: "vault-filter-section.component.html",
  standalone: false,
})
export class VaultFilterSectionComponent {
  private activeUserId$ = getUserId(this.accountService.activeAccount$);

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() activeFilter: VaultFilter;
  readonly section = input.required<VaultFilterSection>();

  /** Whether this section is the collection filter (enables coachmark) */
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() isCollectionFilter = false;

  protected readonly coachmarkService = inject(CoachmarkService);

  /** Computed signal for collections coachmark open state */
  protected readonly collectionsCoachmarkOpen = computed(
    () => this.coachmarkService.activeStepId() === "shareWithCollections",
  );

  readonly data = toSignal(toObservable(this.section).pipe(switchMap((s) => s.data$)), {
    initialValue: undefined,
  });
  readonly collapsedFilterNodes = toSignal(this.vaultFilterService.collapsedFilterNodes$, {
    initialValue: new Set<string>(),
  });

  private injectors = new Map<string, Injector>();

  constructor(
    private vaultFilterService: VaultFilterService,
    private injector: Injector,
    private accountService: AccountService,
  ) {}

  get headerNode() {
    return this.data()!;
  }

  get headerInfo() {
    return this.section().header;
  }

  get filters() {
    return this.data()?.children;
  }

  get isOrganizationFilter() {
    return this.data()?.node instanceof Organization;
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
    if (this.section().premiumOptions?.blockFilterAction) {
      await this.section().premiumOptions.blockFilterAction();
      return;
    }

    await this.section().action(filterNode);
  }

  get editInfo() {
    return this.section().edit;
  }

  onEdit(filterNode: TreeNode<VaultFilterType>) {
    this.section().edit?.action(filterNode.node);
  }

  get addInfo() {
    return this.section().add;
  }

  get showAddLink() {
    return this.section().add && this.section().add.route;
  }

  async onAdd() {
    this.section().add?.action();
  }

  get optionsInfo() {
    return this.section().options;
  }

  get premiumFeature() {
    return this.section().premiumOptions?.showBadgeForNonPremium;
  }

  get divider() {
    return this.section().divider;
  }

  isCollapsed(node: ITreeNodeObject) {
    return this.collapsedFilterNodes().has(node.id);
  }

  async toggleCollapse(node: ITreeNodeObject) {
    const nodes = this.collapsedFilterNodes();
    if (nodes.has(node.id)) {
      nodes.delete(node.id);
    } else {
      nodes.add(node.id);
    }
    const userId = await firstValueFrom(this.activeUserId$);
    await this.vaultFilterService.setCollapsedFilterNodes(nodes, userId);
  }

  // an injector is necessary to pass data into a dynamic component
  // here we are creating a new injector for each filter that has options
  createInjector(data: VaultFilterType) {
    let inject = this.injectors.get(data.id);

    if (!inject) {
      // Pass an observable to the component in order to update the component when the data changes
      // as data binding does not work with dynamic components in Angular 15 (inputs are supported starting Angular 16)
      const data$ = this.section().data$.pipe(
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
