import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";
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
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  IconComponent,
  MultiSelectModule,
  RadioButtonModule,
  SelectItemView,
  TabsModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  AccessRule,
  AccessRuleKind,
  AccessRuleRequest,
  AccessRuleResponse,
  PamApiService,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

export type AccessRuleDialogData = {
  organizationId: string;
  /** Present in edit mode; absent for create. */
  existing?: AccessRuleResponse;
};

export type AccessRuleDialogResult = "saved";

const NAME_MAX_LENGTH = 256;

const TAB_DETAILS = 0;

@Component({
  templateUrl: "./access-rule-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AsyncActionsModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    IconButtonModule,
    IconComponent,
    MultiSelectModule,
    RadioButtonModule,
    TabsModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class AccessRuleDialogComponent implements OnInit {
  protected readonly data = inject<AccessRuleDialogData>(DIALOG_DATA);
  private readonly formBuilder = inject(FormBuilder);
  private readonly pamApi = inject(PamApiService);
  private readonly dialogRef = inject<DialogRef<AccessRuleDialogResult>>(DialogRef);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly collectionAdminService = inject(CollectionAdminService);

  protected readonly AccessRuleKind = AccessRuleKind;
  protected readonly editing = this.data.existing != null;
  protected readonly tabIndex = signal(TAB_DETAILS);

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    name: [
      this.data.existing?.name ?? "",
      [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)],
    ],
    description: [this.data.existing?.description ?? ""],
    kind: [
      this.data.existing?.rule.kind ?? (AccessRuleKind.HumanApproval as AccessRuleKind),
      [Validators.required],
    ],
  });

  protected readonly kindIsEditableYet = computed(() => {
    return this.formGroup.controls.kind.value === AccessRuleKind.HumanApproval;
  });

  private readonly allCollections = signal<{ id: string; name: string }[]>([]);
  protected readonly collectionsLoading = signal(true);
  protected readonly selectedCollectionIds = signal<string[]>(
    this.data.existing?.collections ?? [],
  );

  protected readonly availableOptions = computed<SelectItemView[]>(() => {
    const selected = new Set(this.selectedCollectionIds());
    return this.allCollections()
      .filter((c) => !selected.has(c.id))
      .map((c) => ({ id: c.id, listName: c.name, labelName: c.name }));
  });

  protected readonly selectedCollections = computed<{ id: string; name: string }[]>(() => {
    const byId = new Map(this.allCollections().map((c) => [c.id, c]));
    const selectedIds = this.selectedCollectionIds();
    return selectedIds
      .map((id) => byId.get(id) ?? { id, name: id })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  async ngOnInit(): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      const collections = await firstValueFrom(
        this.collectionAdminService.collectionAdminViews$(this.data.organizationId, userId),
      );
      this.allCollections.set(collections.map((c) => ({ id: c.id, name: c.name })));
    } finally {
      this.collectionsLoading.set(false);
    }
  }

  protected addCollections(items: SelectItemView[]): void {
    const incoming = items.map((i) => i.id);
    if (incoming.length === 0) {
      return;
    }
    const existing = new Set(this.selectedCollectionIds());
    for (const id of incoming) {
      existing.add(id);
    }
    this.selectedCollectionIds.set(Array.from(existing));
  }

  protected removeCollection(id: string): void {
    this.selectedCollectionIds.update((ids) => ids.filter((existing) => existing !== id));
  }

  protected readonly submit = async (): Promise<void> => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      if (this.formGroup.controls.name.invalid) {
        this.tabIndex.set(TAB_DETAILS);
      }
      return;
    }

    const value = this.formGroup.getRawValue();
    if (value.kind !== AccessRuleKind.HumanApproval) {
      // Other kinds need editor stories (PM-37272/3/4/5). The template disables
      // submit in that case, but guard here too in case the disabled state is
      // bypassed.
      return;
    }

    const rule: AccessRule = { kind: "human_approval" };
    const request = new AccessRuleRequest({
      name: value.name,
      description: value.description.length === 0 ? null : value.description,
      rule,
      collections: this.selectedCollectionIds(),
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
