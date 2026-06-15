import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  MultiSelectModule,
  SelectItemView,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  AccessRuleRequest,
  AccessRuleResponse,
  AccessCondition,
  ACCESS_RULE_DURATION_PRESETS,
  PamApiService,
  snapToNearestAccessRuleDuration,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { IpAllowlistEditorComponent } from "../access-rule-editor/ip-allowlist/ip-allowlist-editor.component";

export type AccessRuleDialogData = {
  organizationId: string;
  /** Present in edit mode; absent for create. */
  existing?: AccessRuleResponse;
  /** Optional defaults applied when opening the dialog for a new rule from a template. Ignored when `existing` is set. */
  template?: {
    name?: string;
    defaultLeaseDurationSeconds?: number;
    singleActiveLease?: boolean;
    humanApprovalEnabled?: boolean;
    ipAllowlistEnabled?: boolean;
  };
};

export type AccessRuleDialogResult = "saved";

const NAME_MAX_LENGTH = 256;

/** The "no maximum" option in the max-duration picker; never constrains the default. */
const NO_DURATION_CAP = 0;

/** Default number of extensions offered when a rule first enables them. */
const DEFAULT_MAX_EXTENSIONS = 1;

@Component({
  templateUrl: "./access-rule-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    AsyncActionsModule,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    FormFieldModule,
    IpAllowlistEditorComponent,
    MultiSelectModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class AccessRuleDialogComponent implements OnInit {
  private readonly ipAllowlistEditor = viewChild(IpAllowlistEditorComponent);

  protected readonly data = inject<AccessRuleDialogData>(DIALOG_DATA);
  private readonly formBuilder = inject(FormBuilder);
  private readonly pamApi = inject(PamApiService);
  private readonly dialogRef = inject<DialogRef<AccessRuleDialogResult>>(DialogRef);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly collectionAdminService = inject(CollectionAdminService);

  protected readonly editing = this.data.existing != null;
  protected readonly durationOptions = ACCESS_RULE_DURATION_PRESETS;
  protected readonly noDurationCap = NO_DURATION_CAP;

  protected readonly initialCidrs = findCidrs(this.data.existing?.conditions ?? []);

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    name: [
      this.data.existing?.name ?? this.data.template?.name ?? "",
      [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)],
    ],
    description: [this.data.existing?.description ?? ""],
    collections: [[] as SelectItemView[]],
    defaultLeaseDurationSeconds: [
      snapToNearestAccessRuleDuration(
        this.data.existing?.defaultLeaseDurationSeconds ??
          this.data.template?.defaultLeaseDurationSeconds,
      ),
      [Validators.required],
    ],
    // Hard ceiling on any single lease's duration. NO_DURATION_CAP (the first
    // option) means "no cap"; otherwise the lease window is clamped to this at start.
    maxLeaseDurationSeconds: [this.data.existing?.maxLeaseDurationSeconds ?? NO_DURATION_CAP],
    singleActiveLease: [
      this.data.existing?.singleActiveLease ?? this.data.template?.singleActiveLease ?? false,
    ],
    enabled: [this.data.existing?.enabled ?? true],
    allowsExtensions: [this.data.existing?.allowsExtensions ?? false],
    // Only meaningful when allowsExtensions is on; the server requires a positive value in that case.
    maxExtensions: [
      this.data.existing?.maxExtensions ?? DEFAULT_MAX_EXTENSIONS,
      [Validators.min(1)],
    ],
    humanApprovalEnabled: [
      hasKind(this.data.existing?.conditions, "human_approval") ||
        (this.data.template?.humanApprovalEnabled ?? false),
    ],
    ipAllowlistEnabled: [
      hasKind(this.data.existing?.conditions, "ip_allowlist") ||
        (this.data.template?.ipAllowlistEnabled ?? false),
    ],
  });

  private readonly allCollections = signal<{ id: string; name: string }[]>([]);
  protected readonly collectionsLoading = signal(true);

  protected readonly collectionOptions = computed<SelectItemView[]>(() =>
    this.allCollections().map((c) => ({
      id: c.id,
      listName: c.name,
      labelName: c.name,
      icon: "bwi-collection-shared",
    })),
  );

  constructor() {
    this.coupleDurationBounds();
  }

  async ngOnInit(): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const collections = await firstValueFrom(
        this.collectionAdminService.collectionAdminViews$(this.data.organizationId, userId),
      );
      this.allCollections.set(collections.map((c) => ({ id: c.id, name: c.name })));

      // Map the rule's stored collection IDs onto the now-loaded options so the
      // chips render with real names rather than raw UUIDs.
      const optionsById = new Map(this.collectionOptions().map((c) => [c.id, c]));
      const selected = (this.data.existing?.collections ?? [])
        .map((id) => optionsById.get(id))
        .filter((c): c is SelectItemView => c != null);
      this.formGroup.controls.collections.setValue(selected);
    } finally {
      this.collectionsLoading.set(false);
    }
  }

  /**
   * Keep the default duration at or below the max: when the user moves one picker
   * past the other, drag the other along so the pair stays consistent. A max of
   * {@link NO_DURATION_CAP} ("no maximum") never constrains the default. Mutations
   * use `emitEvent: false` so the paired control updates without re-triggering this.
   */
  private coupleDurationBounds(): void {
    const defaultControl = this.formGroup.controls.defaultLeaseDurationSeconds;
    const maxControl = this.formGroup.controls.maxLeaseDurationSeconds;

    defaultControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (maxControl.value !== NO_DURATION_CAP && value > maxControl.value) {
        maxControl.setValue(value, { emitEvent: false });
      }
    });

    maxControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value !== NO_DURATION_CAP && value < defaultControl.value) {
        defaultControl.setValue(value, { emitEvent: false });
      }
    });
  }

  protected readonly submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const value = this.formGroup.getRawValue();
    const conditions: AccessCondition[] = [];

    if (value.humanApprovalEnabled) {
      conditions.push({
        kind: "human_approval",
        approvers: { mode: "collection_managers" },
      });
    }

    if (value.ipAllowlistEnabled) {
      const editor = this.ipAllowlistEditor();
      if (editor == null || !editor.validate()) {
        return;
      }
      conditions.push({
        kind: "ip_allowlist",
        cidrs: editor.currentCidrs.filter((c) => c !== ""),
      });
    }

    const request = new AccessRuleRequest({
      name: value.name,
      description: value.description.length === 0 ? null : value.description,
      conditions,
      collections: value.collections.map((i) => i.id),
      defaultLeaseDurationSeconds: value.defaultLeaseDurationSeconds,
      maxLeaseDurationSeconds:
        value.maxLeaseDurationSeconds === NO_DURATION_CAP ? null : value.maxLeaseDurationSeconds,
      singleActiveLease: value.singleActiveLease,
      enabled: value.enabled,
      allowsExtensions: value.allowsExtensions,
      maxExtensions: value.allowsExtensions ? value.maxExtensions : null,
    });

    try {
      if (this.data.existing != null) {
        await this.pamApi.updateAccessRule(
          this.data.organizationId,
          this.data.existing.id,
          request,
        );
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessRuleUpdated"),
        });
      } else {
        await this.pamApi.createAccessRule(this.data.organizationId, request);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessRuleCreated"),
        });
      }
      await this.dialogRef.close("saved");
    } catch (e) {
      const message =
        e instanceof ErrorResponse
          ? (e.message ?? this.i18nService.t("unexpectedError"))
          : this.i18nService.t("unexpectedError");
      this.toastService.showToast({ variant: "error", message });
    }
  };

  static open(
    dialogService: DialogService,
    config: DialogConfig<AccessRuleDialogData>,
  ): DialogRef<AccessRuleDialogResult> {
    return dialogService.open<AccessRuleDialogResult>(AccessRuleDialogComponent, config);
  }
}

function hasKind(
  conditions: AccessCondition[] | undefined,
  kind: AccessCondition["kind"],
): boolean {
  return conditions?.some((c) => c.kind === kind) ?? false;
}

function findCidrs(conditions: AccessCondition[]): string[] {
  const ip = conditions.find(
    (c): c is Extract<AccessCondition, { kind: "ip_allowlist" }> => c.kind === "ip_allowlist",
  );
  return ip?.cidrs ?? [];
}
