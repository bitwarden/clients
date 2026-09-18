// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  Component,
  inject,
  Injector,
  OnInit,
  output,
  computed,
  signal,
  afterNextRender,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { singleOrganizationPolicyApplies$ } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import {
  NavigationModule,
  DialogService,
  A11yTitleDirective,
  SideNavService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  FolderFilter,
  VaultFilter,
  VaultFilterServiceAbstraction as VaultFilterService,
  AddEditFolderDialogComponent,
  RoutedVaultFilterBridgeService,
  Vfo1I18nPipe,
  Vfo1IconPipe,
} from "@bitwarden/vault";

import { DesktopPremiumUpgradePromptService } from "../../../../billing/services/desktop-premium-upgrade-prompt.service";

import { CollectionFilterComponent } from "./filters/collection-filter.component";
import { FolderFilterComponent } from "./filters/folder-filter.component";
import { OrganizationFilterComponent } from "./filters/organization-filter.component";
import { StatusFilterComponent } from "./filters/status-filter.component";
import { TypeFilterComponent } from "./filters/type-filter.component";
import { PersistedVaultFilterExpansionService } from "./services/persisted-vault-filter-expansion.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-vault-filter",
  templateUrl: "vault-filter.component.html",
  imports: [
    I18nPipe,
    NavigationModule,
    CommonModule,
    OrganizationFilterComponent,
    StatusFilterComponent,
    TypeFilterComponent,
    CollectionFilterComponent,
    FolderFilterComponent,
    A11yTitleDirective,
    Vfo1I18nPipe,
    Vfo1IconPipe,
  ],
  providers: [
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
})
export class VaultFilterComponent implements OnInit {
  private routedVaultFilterBridgeService = inject(RoutedVaultFilterBridgeService);
  private vaultFilterService: VaultFilterService = inject(VaultFilterService);
  private accountService: AccountService = inject(AccountService);
  private folderService: FolderService = inject(FolderService);
  private policyService: PolicyService = inject(PolicyService);
  private dialogService: DialogService = inject(DialogService);
  private collapseService = inject(PersistedVaultFilterExpansionService);
  private sideNavService = inject(SideNavService);
  private injector = inject(Injector);
  private componentIsDestroyed$ = new Subject<boolean>();

  /**
   * Node id for the outermost "Vault" group's persisted collapse state. No tree backs this
   * group, so it uses a fixed id rather than a tree node id like the sections below it.
   */
  protected readonly vaultGroupNodeId = "Vault";

  /**
   * `NavGroupComponent` isn't part of `@bitwarden/components`'s public API, so this is typed
   * against just the piece we need: its writable `open` model.
   */
  private readonly vaultGroup = viewChild<{ open: { set: (open: boolean) => void } }>("vaultGroup");

  /**
   * The nav-group tree (behind `@if (isLoaded)`) doesn't mount until partway through `ngOnInit`,
   * so a constructor-time settle check would fire too early, before it ever renders. This is set
   * once the render *after* `isLoaded` flips true, so `bit-nav-group`'s own lifecycle-driven opens
   * (e.g. its route-matching effect forcing this group open) don't get mistaken for a user action
   * and persisted over a saved collapsed preference.
   */
  private readonly settled = signal(false);

  /**
   * True while a real user interaction is in progress inside the "Vault" group. Set on
   * `mousedown` and `keydown` — both of which fire before any descendant's resulting `click`
   * handler, e.g. the collapse chevron's `toggle()` or the main row's
   * `handleMainContentClicked()` (mouse/touch activation fires `mousedown` before `click`;
   * keyboard activation of a button via Enter/Space fires `keydown` before the synthesized
   * `click`) — so it's a reliable signal that an `openChange` about to fire originates from an
   * actual user action, not a programmatic force (e.g. `NavItemComponent.setIsActive()`, which
   * unconditionally re-opens a group whenever its route becomes active — on "Vault" specifically,
   * that's whenever the "vault" route is active, i.e. essentially any time this component mounts
   * or the router returns to it, regardless of side nav state, settle timing, or vfo1).
   *
   * Cleared on a short timer rather than the next microtask or the bubbled `click`: a browser
   * dispatches `mousedown`/`keydown` and `click` as separate tasks, so a microtask-queued clear
   * runs before `click` ever fires — permanently starving the toggle. Clearing on the bubbled
   * `click` doesn't work either, since the chevron's own `toggle()` calls `event.stopPropagation()`.
   */
  private vaultGroupInteracted = false;
  private vaultGroupInteractedTimeout: ReturnType<typeof setTimeout> | undefined;

  protected onVaultGroupInteractionStart() {
    this.vaultGroupInteracted = true;
    clearTimeout(this.vaultGroupInteractedTimeout);
    this.vaultGroupInteractedTimeout = setTimeout(() => {
      this.vaultGroupInteracted = false;
    }, 500);
  }

  protected readonly activeFilter = signal<VaultFilter | null>(null);
  protected onFilterChange = output<VaultFilter>();

  private activeUserId: UserId;
  protected isLoaded = false;
  protected activeOrganizationDataOwnershipPolicy: boolean;
  protected activeSingleOrganizationPolicy: boolean;
  protected readonly organizations = toSignal(this.vaultFilterService.organizationTree$);
  protected readonly collections = toSignal(this.vaultFilterService.collectionTree$);
  protected readonly folders = toSignal(this.vaultFilterService.folderTree$);
  protected readonly cipherTypes = toSignal(this.vaultFilterService.cipherTypeTree$);

  protected readonly showCollectionsFilter = computed<boolean>(() => {
    return (
      this.organizations() != null &&
      this.nonIndividualVaultOrganizations().length > 0 &&
      !this.activeFilter()?.isMyVaultSelected &&
      !this.allOrganizationsDisabled()
    );
  });

  protected readonly allOrganizationsDisabled = computed<boolean>(() => {
    if (!this.organizations()) {
      return false;
    }
    const orgs = this.nonIndividualVaultOrganizations();
    return orgs.length > 0 && orgs.every((org) => !org.node.enabled);
  });

  private nonIndividualVaultOrganizations() {
    return this.organizations().children.filter((org) => org.node.id !== "MyVault");
  }

  protected isOpen(nodeId: string | undefined): boolean {
    return this.collapseService.isOpen(nodeId);
  }

  protected onOpenChange(nodeId: string | undefined, open: boolean) {
    if (nodeId === this.vaultGroupNodeId) {
      // Only trust this as real user intent when the component has settled (see `settled`), it
      // happened during an actual pointer interaction with the group (see
      // `vaultGroupInteracted`), AND — for an open — the side nav wasn't collapsed to its icon
      // rail, since `handleMainContentClicked()` unconditionally force-opens a group (bypassing
      // `disableToggleOnClick`) there, which is the side nav expanding, not the user asking to
      // remember "Vault" as expanded. Anything else (a route-activation cascade via
      // `NavItemComponent.setIsActive()`, a lifecycle-driven open before settling, etc.) writes
      // straight to the model, so `[open]="isOpen(...)"` won't naturally re-assert the correct
      // value afterwards — Angular only re-pushes a property binding when the *source
      // expression's* result changes, and `isOpen(nodeId)` hasn't — so revert it back to the
      // persisted preference directly.
      const isGenuineUserToggle =
        this.settled() && this.vaultGroupInteracted && (!open || this.sideNavService.open());
      if (!isGenuineUserToggle) {
        this.vaultGroup()?.open.set(this.isOpen(nodeId));
        return;
      }
      void this.collapseService.setOpen(nodeId, open);
      return;
    }

    if (!this.settled()) {
      return;
    }
    void this.collapseService.setOpen(nodeId, open);
  }

  private async setActivePolicies() {
    this.activeOrganizationDataOwnershipPolicy = await firstValueFrom(
      this.policyService.policyAppliesToUser$(
        PolicyType.OrganizationDataOwnership,
        this.activeUserId,
      ),
    );
    this.activeSingleOrganizationPolicy = await firstValueFrom(
      singleOrganizationPolicyApplies$(this.activeUserId, this.policyService),
    );
  }

  async ngOnInit(): Promise<void> {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (this.organizations() != null && this.organizations().children.length > 0) {
      await this.setActivePolicies();
    }

    this.routedVaultFilterBridgeService.activeFilter$
      .pipe(takeUntil(this.componentIsDestroyed$))
      .subscribe((filter) => {
        this.activeFilter.set(filter);
      });

    this.isLoaded = true;
    afterNextRender(() => this.settled.set(true), { injector: this.injector });
  }

  protected async editFolder(folder: FolderFilter) {
    if (!this.activeUserId) {
      return;
    }
    const folderView = await firstValueFrom(
      this.folderService.getDecrypted$(folder.id, this.activeUserId),
    );

    if (!folderView) {
      return;
    }

    AddEditFolderDialogComponent.open(this.dialogService, {
      editFolderConfig: {
        folder: {
          ...folderView,
        },
      },
    });
  }
}
