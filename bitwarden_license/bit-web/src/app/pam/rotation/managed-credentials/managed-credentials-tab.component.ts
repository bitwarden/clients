import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { NoResults } from "@bitwarden/assets/svg";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeModule,
  ButtonModule,
  DialogService,
  FilterMenuComponent,
  FilterMenuModule,
  IconButtonModule,
  IconModule,
  MenuModule,
  SearchModule,
  SpinnerComponent,
  StatusLockupComponent,
  SvgComponent,
  TableDataSource,
  TableModule,
  ToastService,
  TooltipDirective,
} from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrgCiphersService } from "../org-ciphers.service";
import { TargetSystemMethod, TargetSystem } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { RotationConfigRow } from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

/**
 * Managed credentials tab: lists all rotation configs for the organisation.
 *
 * Row menu actions call the service methods directly and show toasts on success,
 * or display an error toast on failure. Confirmations use DialogService.openSimpleDialog.
 * The edit page is a sibling of the shell, so navigation uses ["..", "managed-credentials", id].
 */
@Component({
  selector: "app-managed-credentials-tab",
  templateUrl: "./managed-credentials-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BadgeModule,
    ButtonModule,
    FilterMenuModule,
    IconButtonModule,
    IconModule,
    MenuModule,
    SearchModule,
    SpinnerComponent,
    StatusLockupComponent,
    SvgComponent,
    TableModule,
    TooltipDirective,
    I18nPipe,
  ],
})
export class ManagedCredentialsTabComponent {
  protected readonly noItemsIcon = NoResults;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly configsService = inject(RotationConfigsService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly orgCiphersService = inject(OrgCiphersService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = toSignal(this.configsService.loading$, { initialValue: true });

  private readonly rows = toSignal(this.configsService.rows$, {
    initialValue: [] as RotationConfigRow[],
  });

  /**
   * Whether any target systems exist. A rotation config always references a target system, so
   * with none the tab directs the user to set one up first instead of offering to create a config.
   */
  private readonly targetSystems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [] as TargetSystem[],
  });
  protected readonly hasTargetSystems = computed(() => this.targetSystems().length > 0);

  protected readonly dataSource = new TableDataSource<RotationConfigRow>();

  protected readonly searchControl = new FormControl("", { nonNullable: true });
  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  /** Expose for template. */
  protected readonly TargetSystemMethod = TargetSystemMethod;

  /** Status/target-system/collection toolbar chips; read directly rather than via a form control. */
  private readonly statusFilterChip = viewChild<FilterMenuComponent>("statusFilter");
  private readonly targetSystemFilterChip = viewChild<FilterMenuComponent>("targetSystemFilter");
  private readonly collectionFilterChip = viewChild<FilterMenuComponent>("collectionFilter");

  /** Distinct target system names present in the currently-loaded rows, sorted for the chip. */
  protected readonly targetSystemNames = computed(() =>
    [...new Set(this.rows().map((r) => r.targetSystemName))].sort((a, b) => a.localeCompare(b)),
  );

  private readonly ciphers = toSignal(this.orgCiphersService.ciphers$, {
    initialValue: [] as CipherView[],
  });

  /** Each cipher's collection ids, keyed by its id, for resolving a row's collections via `cipherId`. */
  private readonly cipherCollectionIdsById = computed(() => {
    const map = new Map<CipherId, string[]>();
    for (const cipher of this.ciphers()) {
      map.set(asUuid<CipherId>(cipher.id), cipher.collectionIds);
    }
    return map;
  });

  /**
   * The org's collections, for resolving the ids above to names. Loaded directly here rather than
   * through a page-scoped service, since `CollectionAdminService` is already provided at the app
   * root (see `apps/web/src/app/core/core.module.ts`) and `access-rules.component.ts` reads it the
   * same way.
   */
  private readonly collections = signal<CollectionAdminView[]>([]);

  /**
   * Collection filter options: only the collections actually reachable from a visible row's
   * cipher, not every collection in the org — an option nothing on this page matches is noise, not
   * a filter.
   */
  protected readonly collectionOptions = computed(() => {
    const nameById = new Map(this.collections().map((c) => [uuidAsString(c.id), c.name]));
    const collectionIdsByCipher = this.cipherCollectionIdsById();
    const present = new Set<string>();
    for (const row of this.rows()) {
      for (const collectionId of collectionIdsByCipher.get(row.config.cipherId) ?? []) {
        present.add(collectionId);
      }
    }
    return [...present]
      .map((id) => ({ id, name: nameById.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  constructor() {
    effect(() => {
      const organizationId = this.organizationId();
      void this.configsService.load(organizationId);
      // Also load target systems so the empty state can tell whether the user must set one up
      // first (the shell-scoped instance may be empty if this tab is visited before the others).
      void this.targetSystemsService.load(organizationId);
      void this.loadCollections(organizationId);
    });

    effect(() => {
      this.dataSource.data = this.rows();
    });

    effect(() => {
      const text = this.searchText().trim().toLowerCase();
      const status = this.statusFilterChip()?.value() as string | null | undefined;
      const targetSystemName = this.targetSystemFilterChip()?.value() as string | null | undefined;
      const collectionId = this.collectionFilterChip()?.value() as string | null | undefined;
      const collectionIdsByCipher = this.cipherCollectionIdsById();

      this.dataSource.filter = (row) => {
        if (
          text !== "" &&
          !row.cipherName.toLowerCase().includes(text) &&
          !row.targetSystemName.toLowerCase().includes(text)
        ) {
          return false;
        }
        if (status != null && row.statusLabelKey !== status) {
          return false;
        }
        if (targetSystemName != null && row.targetSystemName !== targetSystemName) {
          return false;
        }
        if (
          collectionId != null &&
          !(collectionIdsByCipher.get(row.config.cipherId) ?? []).includes(collectionId)
        ) {
          return false;
        }
        return true;
      };
    });
  }

  private async loadCollections(organizationId: OrganizationId): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const collections = await firstValueFrom(
      this.collectionAdminService.collectionAdminViews$(organizationId, userId),
    );
    this.collections.set(collections);
  }

  protected readonly processedRows = toSignal(this.dataSource.connect(), {
    initialValue: [] as RotationConfigRow[],
  });

  protected readonly isEmpty = computed(() => !this.loading() && this.rows().length === 0);
  protected readonly noResults = computed(
    () => !this.loading() && this.rows().length > 0 && this.processedRows().length === 0,
  );

  protected readonly openCreate = (): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", "new"], { relativeTo: this.route });

  /** Navigate to the sibling Target systems tab (shown when none exist yet). */
  protected readonly goToTargetSystems = (): Promise<boolean> =>
    this.router.navigate(["..", "target-systems"], { relativeTo: this.route });

  protected readonly openEdit = (row: RotationConfigRow): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", row.id], { relativeTo: this.route });

  protected readonly rotateNow = async (row: RotationConfigRow): Promise<void> => {
    try {
      await this.configsService.rotateNow(row.config);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigRotateNowSuccess"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly confirmRecordManual = async (row: RotationConfigRow): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamRotationConfigRecordManualTitle" },
      content: { key: "pamRotationConfigRecordManualContent" },
      acceptButtonText: { key: "pamRotationConfigRecordManualConfirm" },
      cancelButtonText: { key: "cancel" },
      type: "info",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.configsService.recordManual(row.config);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigRecordManualSuccess"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly pause = async (row: RotationConfigRow): Promise<void> => {
    try {
      await this.configsService.pause(row.config);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigPauseSuccess"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly resume = async (row: RotationConfigRow): Promise<void> => {
    try {
      await this.configsService.resume(row.config);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigResumeSuccess"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly confirmDelete = async (row: RotationConfigRow): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamRotationConfigDeleteConfirmTitle" },
      content: { key: "pamRotationConfigDeleteConfirmContent" },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.configsService.delete(row.config);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigDeleteSuccess"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}
