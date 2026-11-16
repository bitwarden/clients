import { ChangeDetectionStrategy, Component } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { merge } from "rxjs";
import { map } from "rxjs/operators";

import {
  AutotypeShortcutComponent,
  formatAutotypeShortcut,
} from "@bitwarden/angular/desktop-native/components/autotype-shortcut.component";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AutotypeFeatureFlagState } from "@bitwarden/common/desktop-native/enums/autotype-feature-flag-state.enum";
import {
  AutotypeGaPolicyData,
  AutotypeShortcutOption,
  DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT,
  isAutotypeGaShortcut,
} from "@bitwarden/common/desktop-native/models/autotype-ga-policy.data";
import { autotypeFeatureFlagState$ } from "@bitwarden/common/desktop-native/services/autotype-feature-flags";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  LinkComponent,
  RadioButtonModule,
  SwitchComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BasePolicyEditComponent, BasePolicyEditDefinition } from "../base-policy-edit.component";
import { PolicyCategory } from "../pipes/policy-category";

export class DesktopAutotypeGaPolicy extends BasePolicyEditDefinition {
  name = "desktopAppAutofillPolicyTitle";
  description = "desktopAppAutofillPolicyDesc";
  type = PolicyType.AutotypeGaPolicy;
  category = PolicyCategory.VaultManagement;
  priority = 71;
  component = DesktopAutotypeGaPolicyComponent;
  showDescription = false;

  display$(organization: Organization, configService: ConfigService) {
    return autotypeFeatureFlagState$(configService).pipe(
      map((state) => state === AutotypeFeatureFlagState.Ga),
    );
  }
}

@Component({
  selector: "app-autotype-ga-policy-edit",
  template: `
    <p bitTypography="body1">
      {{ "desktopAppAutofillPolicyDrawerDesc" | i18n }}
      <a
        bitLink
        href="https://bitwarden.com/help/autofill-from-desktop-app/"
        target="_blank"
        rel="noreferrer"
        endIcon="bwi-external-link"
        >{{ "learnMore" | i18n }}</a
      >
    </p>
    <bit-form-control>
      <bit-switch [formControl]="enabled"></bit-switch>
      <bit-label>{{ "enablePolicy" | i18n }}</bit-label>
    </bit-form-control>
    <div [formGroup]="data">
      <bit-form-control-group formControlName="shortcutOption" [block]="true">
        <bit-label>
          <span class="tw-flex tw-flex-col">
            <span>{{ "appAutofillShortcut" | i18n }}</span>
            <span bitTypography="body2" class="tw-text-muted tw-font-normal">
              {{ "appAutofillShortcutDesc" | i18n }}
            </span>
          </span>
        </bit-label>
        <bit-form-control disableMargin>
          <input
            type="radio"
            bitRadio
            [value]="shortcutOptions.Default"
            id="autotype-ga-policy_input_shortcut-default"
          />
          <bit-label>{{ "default" | i18n }}</bit-label>
          <bit-hint>{{ "autotypeDefaultShortcutDesc" | i18n: defaultShortcutText }}</bit-hint>
        </bit-form-control>
        <bit-form-control disableMargin>
          <input
            type="radio"
            bitRadio
            [value]="shortcutOptions.Custom"
            id="autotype-ga-policy_input_shortcut-custom"
          />
          <bit-label>{{ "custom" | i18n }}</bit-label>
          <bit-hint>{{ "autotypeCustomShortcutDesc" | i18n }}</bit-hint>
        </bit-form-control>
      </bit-form-control-group>
      @if (selectedShortcutOption() === shortcutOptions.Custom) {
        <app-autotype-shortcut
          class="tw-block"
          [inline]="true"
          [shortcut]="customShortcut()"
          (shortcutChange)="onCustomShortcut($event)"
        />
      }
    </div>
  `,
  imports: [
    ReactiveFormsModule,
    AutotypeShortcutComponent,
    LinkComponent,
    RadioButtonModule,
    SwitchComponent,
    TypographyModule,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesktopAutotypeGaPolicyComponent extends BasePolicyEditComponent {
  protected readonly shortcutOptions = AutotypeShortcutOption;
  protected readonly defaultShortcutText = formatAutotypeShortcut(
    DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT,
  );

  private readonly shortcutOption = new FormControl<AutotypeShortcutOption>(
    AutotypeShortcutOption.Default,
    { nonNullable: true },
  );

  /**
   * The custom shortcut. Kept while Default is selected so switching back restores it.
   * Required only while Custom is selected and the policy is on.
   */
  private readonly defaultKeyboardShortcut = new FormControl<string[] | null>(null, {
    validators: (control) => {
      if (control.value != null && !isAutotypeGaShortcut(control.value)) {
        return { invalidShortcut: true };
      }

      return control.value == null &&
        this.shortcutOption.value === AutotypeShortcutOption.Custom &&
        this.enabled.value === true
        ? { required: true }
        : null;
    },
  });

  protected readonly customShortcut = toSignal(this.defaultKeyboardShortcut.valueChanges, {
    initialValue: this.defaultKeyboardShortcut.value,
  });

  protected readonly selectedShortcutOption = toSignal(this.shortcutOption.valueChanges, {
    initialValue: this.shortcutOption.value,
  });

  readonly data = new FormGroup({
    shortcutOption: this.shortcutOption,
    defaultKeyboardShortcut: this.defaultKeyboardShortcut,
  });

  constructor() {
    super();

    // The shortcut's required check depends on the option and the policy toggle.
    merge(this.shortcutOption.valueChanges, this.enabled.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.defaultKeyboardShortcut.updateValueAndValidity();
      });
  }

  protected onCustomShortcut(keys: string[] | null): void {
    this.defaultKeyboardShortcut.setValue(keys);
    this.data.markAsDirty();
  }

  /** Saved data without the Custom option, including data from before this setting existed, loads as Default. */
  protected override loadData() {
    const data = this.policyResponse()?.data as Partial<AutotypeGaPolicyData> | null;
    const custom = data?.shortcutOption === AutotypeShortcutOption.Custom;
    const storedShortcut = data?.defaultKeyboardShortcut;
    const stored = isAutotypeGaShortcut(storedShortcut) ? storedShortcut : null;

    this.defaultKeyboardShortcut.setValue(custom ? stored : null);
    this.shortcutOption.setValue(
      custom ? AutotypeShortcutOption.Custom : AutotypeShortcutOption.Default,
    );
  }

  protected override buildRequestData(): AutotypeGaPolicyData {
    if (this.shortcutOption.value === AutotypeShortcutOption.Custom) {
      return {
        shortcutOption: AutotypeShortcutOption.Custom,
        defaultKeyboardShortcut: this.defaultKeyboardShortcut.value,
      };
    }

    return {
      shortcutOption: AutotypeShortcutOption.Default,
      defaultKeyboardShortcut: [...DEFAULT_AUTOTYPE_GA_KEYBOARD_SHORTCUT],
    };
  }
}
