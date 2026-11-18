import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Observable, map, startWith, switchMap } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { getRestrictedItemTypes } from "@bitwarden/common/vault/utils/restricted-item-types.utils";
import {
  CalloutComponent,
  CheckboxModule,
  FormControlModule,
  SwitchComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { Vfo1I18nPipe } from "@bitwarden/vault";

import { BasePolicyEditComponent, BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

import { SimpleTogglePolicyComponent } from "./simple-toggle-policy.component";

type ManagedItemType = {
  cipherType: CipherType;
  labelKey: string;
  /** i18n keys for the "will be hidden" help text, taking the item count as `$1`. */
  hiddenKey: { one: string; other: string };
  /** Hidden from admins until the new item types feature flag is enabled. */
  requiresNewItemTypes: boolean;
};

/**
 * The item types an admin can allow or restrict, in display order.
 */
const MANAGED_ITEM_TYPES: readonly ManagedItemType[] = [
  {
    cipherType: CipherType.Card,
    labelKey: "typeCard",
    hiddenKey: { one: "existingCardWillBeHidden", other: "existingCardsWillBeHidden" },
    requiresNewItemTypes: false,
  },
  {
    cipherType: CipherType.BankAccount,
    labelKey: "typeBankAccount",
    hiddenKey: {
      one: "existingBankAccountWillBeHidden",
      other: "existingBankAccountsWillBeHidden",
    },
    requiresNewItemTypes: true,
  },
  {
    cipherType: CipherType.Identity,
    labelKey: "typeIdentity",
    hiddenKey: { one: "existingIdentityWillBeHidden", other: "existingIdentitiesWillBeHidden" },
    requiresNewItemTypes: false,
  },
  {
    cipherType: CipherType.DriversLicense,
    labelKey: "typeDriversLicense",
    hiddenKey: { one: "existingLicenseWillBeHidden", other: "existingLicensesWillBeHidden" },
    requiresNewItemTypes: true,
  },
  {
    cipherType: CipherType.Passport,
    labelKey: "typePassport",
    hiddenKey: { one: "existingPassportWillBeHidden", other: "existingPassportsWillBeHidden" },
    requiresNewItemTypes: true,
  },
];

/**
 * The original policy: a single toggle that restricts card items. Shown until the new item types
 * feature is released.
 */
export class RestrictedItemTypesPolicy extends BasePolicyEditDefinition {
  name = "restrictedItemTypePolicy";
  description = "restrictedItemTypePolicyDescV2";
  descriptionVfo1 = "restrictedItemTypePolicyDescListVfo1";
  drawerDescriptionVfo1 = "restrictedItemTypePolicyDescVfo1";
  type = PolicyType.RestrictedItemTypes;
  category = PolicyCategory.VaultManagement;
  priority = 50;
  component = SimpleTogglePolicyComponent;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes).pipe(map((on) => !on));
  }
}

/**
 * The "Manage item types" policy. Replaces {@link RestrictedItemTypesPolicy} when the new item
 * types feature flag is on. Both definitions edit the same policy type and its stored data stays
 * compatible.
 */
export class ManageItemTypesPolicy extends BasePolicyEditDefinition {
  name = "manageItemTypesPolicy";
  description = "manageItemTypesPolicyDesc";
  type = PolicyType.RestrictedItemTypes;
  category = PolicyCategory.VaultManagement;
  priority = 50;
  component = RestrictedItemTypesPolicyComponent;

  override display$(organization: Organization, configService: ConfigService): Observable<boolean> {
    return configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes);
  }
}

/**
 * Edits the "Manage item types" policy.
 *
 * The UI lists the item types members are *allowed* to use (checked). On save, the unchecked types
 * are stored as `{ restrictedTypes: CipherType[] }`. Existing policies have no data and restrict
 * cards only, so an enabled legacy policy loads with Card unchecked.
 */
@Component({
  selector: "restricted-item-types-policy-edit",
  templateUrl: "restricted-item-types.component.html",
  imports: [
    ReactiveFormsModule,
    CalloutComponent,
    FormControlModule,
    CheckboxModule,
    SwitchComponent,
    I18nPipe,
    Vfo1I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestrictedItemTypesPolicyComponent extends BasePolicyEditComponent {
  private readonly configService = inject(ConfigService);
  private readonly policyService = inject(PolicyService);

  /** One checkbox per managed item type, keyed by cipher type. Checked means members may use it. */
  override readonly data = new FormGroup<Record<string, FormControl<boolean>>>(
    Object.fromEntries(
      MANAGED_ITEM_TYPES.map(({ cipherType }) => [
        cipherType,
        new FormControl(true, { nonNullable: true }),
      ]),
    ),
  );

  /**
   * Number of existing items per cipher type across the organization's vaults. Used to tell admins
   * how many items will be hidden when they deselect a type.
   */
  /** Whether the single organization policy, which this policy requires, is on. */
  protected readonly singleOrgEnabled = signal(true);

  readonly existingItemCounts = signal<Partial<Record<CipherType, number>>>({});

  private readonly newItemTypesEnabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes),
    { initialValue: false },
  );

  private readonly dataValue = toSignal(this.data.valueChanges.pipe(startWith(this.data.value)));

  protected readonly itemTypes = computed(() => {
    const newItemTypesEnabled = this.newItemTypesEnabled();
    const checked = this.dataValue() ?? {};
    const counts = this.existingItemCounts();

    return MANAGED_ITEM_TYPES.filter(
      ({ requiresNewItemTypes }) => !requiresNewItemTypes || newItemTypesEnabled,
    ).map(({ cipherType, labelKey, hiddenKey }) => {
      // Only warn while turning the policy on; when returning to edit a policy that is already on
      // the items are already hidden.
      const hiddenItemCount =
        !this.policyResponse()?.enabled && checked[cipherType] === false
          ? (counts[cipherType] ?? 0)
          : 0;

      return {
        cipherType,
        labelKey,
        control: this.data.controls[cipherType],
        hiddenItemCount,
        hiddenItemsKey: hiddenItemCount === 1 ? hiddenKey.one : hiddenKey.other,
      };
    });
  });

  constructor() {
    super();

    // The policy cannot be turned on until the single organization policy is on.
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) => this.policyService.policies$(userId)),
        map((policies) => policies.find((p) => p.type === PolicyType.SingleOrg)?.enabled ?? false),
        takeUntilDestroyed(),
      )
      .subscribe((singleOrgEnabled) => {
        this.singleOrgEnabled.set(singleOrgEnabled);

        if (singleOrgEnabled) {
          this.enabled.enable();
        } else {
          this.enabled.disable();
        }
      });

    // Selections stay editable only while the policy is on, but are retained when it is turned off.
    this.enabled.valueChanges
      .pipe(startWith(this.enabled.value), takeUntilDestroyed())
      .subscribe((enabled) => {
        if (enabled) {
          this.data.enable();
        } else {
          this.data.disable();
        }
      });
  }

  override submitToastKey(): string {
    const wasEnabled = this.policyResponse()?.enabled ?? false;
    const isEnabled = this.enabled.value ?? false;

    if (!wasEnabled && isEnabled) {
      return "policyTurnedOn";
    }
    if (wasEnabled && !isEnabled) {
      return "policyTurnedOff";
    }

    return "policyEdited";
  }

  override ngOnInit(): void {
    super.ngOnInit();

    // The base class only loads data when the response includes it, but legacy policies have none.
    if (this.policyResponse()?.data == null) {
      this.loadData();
    }
  }

  protected override loadData(): void {
    const restricted = this.restrictedTypesFromResponse();

    for (const { cipherType } of MANAGED_ITEM_TYPES) {
      this.data.controls[cipherType].setValue(!restricted.includes(cipherType));
    }
  }

  /** Serializes the form to `{ restrictedTypes }`. */
  protected override buildRequestData() {
    const raw = this.data.getRawValue();
    const managed = MANAGED_ITEM_TYPES.map(({ cipherType }) => cipherType);

    const unmanagedRestricted = this.storedRestrictedTypes().filter((t) => !managed.includes(t));
    const restrictedTypes = [
      ...managed.filter((cipherType) => raw[cipherType] === false),
      ...unmanagedRestricted,
    ];

    return { restrictedTypes };
  }

  private restrictedTypesFromResponse(): CipherType[] {
    // A policy that was never turned on has nothing restricted. Otherwise missing data means a
    // legacy policy, which restricts cards only.
    if (!this.policyResponse()?.enabled && this.policyResponse()?.data == null) {
      return [];
    }

    return this.storedRestrictedTypes();
  }

  private storedRestrictedTypes(): CipherType[] {
    return getRestrictedItemTypes(this.policyResponse()?.data);
  }
}
