// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { map, Observable } from "rxjs";

import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../admin-console/enums";
import {
  AUTOFILL_SETTINGS_DISK,
  AUTOFILL_SETTINGS_DISK_LOCAL,
  ActiveUserState,
  GlobalState,
  KeyDefinition,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";
import { ClearClipboardDelay, AutofillOverlayVisibility } from "../constants";
import { ClearClipboardDelaySetting, InlineMenuVisibilitySetting } from "../types";

const AUTOFILL_ON_PAGE_LOAD = new UserKeyDefinition(AUTOFILL_SETTINGS_DISK, "autofillOnPageLoad", {
  deserializer: (value: boolean) => value ?? false,
  clearOn: [],
});

const AUTOFILL_ON_PAGE_LOAD_DEFAULT = new UserKeyDefinition(
  AUTOFILL_SETTINGS_DISK,
  "autofillOnPageLoadDefault",
  {
    deserializer: (value: boolean) => value ?? false,
    clearOn: [],
  },
);

const AUTOFILL_ON_PAGE_LOAD_CALLOUT_DISMISSED = new UserKeyDefinition(
  AUTOFILL_SETTINGS_DISK,
  "autofillOnPageLoadCalloutIsDismissed",
  {
    deserializer: (value: boolean) => value ?? false,
    clearOn: [],
  },
);

const AUTOFILL_ON_PAGE_LOAD_POLICY_TOAST_HAS_DISPLAYED = new UserKeyDefinition(
  AUTOFILL_SETTINGS_DISK,
  "autofillOnPageLoadPolicyToastHasDisplayed",
  {
    deserializer: (value: boolean) => value ?? false,
    clearOn: [],
  },
);

const AUTO_COPY_TOTP = new UserKeyDefinition(AUTOFILL_SETTINGS_DISK, "autoCopyTotp", {
  deserializer: (value: boolean) => value ?? true,
  clearOn: [],
});

const INLINE_MENU_VISIBILITY = new KeyDefinition(
  AUTOFILL_SETTINGS_DISK_LOCAL,
  "inlineMenuVisibility",
  {
    deserializer: (value: InlineMenuVisibilitySetting) => value ?? AutofillOverlayVisibility.Off,
  },
);

const SHOW_INLINE_MENU_IDENTITIES = new UserKeyDefinition(
  AUTOFILL_SETTINGS_DISK,
  "showInlineMenuIdentities",
  {
    deserializer: (value: boolean) => value ?? true,
    clearOn: [],
  },
);

const SHOW_INLINE_MENU_CARDS = new UserKeyDefinition(
  AUTOFILL_SETTINGS_DISK,
  "showInlineMenuCards",
  {
    deserializer: (value: boolean) => value ?? true,
    clearOn: [],
  },
);

const ENABLE_CONTEXT_MENU = new KeyDefinition(AUTOFILL_SETTINGS_DISK, "enableContextMenu", {
  deserializer: (value: boolean) => value ?? true,
});

const CLEAR_CLIPBOARD_DELAY = new UserKeyDefinition(
  AUTOFILL_SETTINGS_DISK_LOCAL,
  "clearClipboardDelay",
  {
    deserializer: (value: ClearClipboardDelaySetting) => value ?? ClearClipboardDelay.Never,
    clearOn: [],
  },
);

export abstract class AutofillSettingsServiceAbstraction {
  autofillOnPageLoad$: Observable<boolean>;
  setAutofillOnPageLoad: (newValue: boolean) => Promise<void>;
  autofillOnPageLoadDefault$: Observable<boolean>;
  setAutofillOnPageLoadDefault: (newValue: boolean) => Promise<void>;
  autofillOnPageLoadCalloutIsDismissed$: Observable<boolean>;
  setAutofillOnPageLoadCalloutIsDismissed: (newValue: boolean) => Promise<void>;
  activateAutofillOnPageLoadFromPolicy$: Observable<boolean>;
  setAutofillOnPageLoadPolicyToastHasDisplayed: (newValue: boolean) => Promise<void>;
  autofillOnPageLoadPolicyToastHasDisplayed$: Observable<boolean>;
  autoCopyTotp$: Observable<boolean>;
  setAutoCopyTotp: (newValue: boolean) => Promise<void>;
  inlineMenuVisibility$: Observable<InlineMenuVisibilitySetting>;
  setInlineMenuVisibility: (newValue: InlineMenuVisibilitySetting) => Promise<void>;
  showInlineMenuIdentities$: Observable<boolean>;
  setShowInlineMenuIdentities: (newValue: boolean) => Promise<void>;
  showInlineMenuCards$: Observable<boolean>;
  setShowInlineMenuCards: (newValue: boolean) => Promise<void>;
  enableContextMenu$: Observable<boolean>;
  setEnableContextMenu: (newValue: boolean) => Promise<void>;
  clearClipboardDelay$: Observable<ClearClipboardDelaySetting>;
  setClearClipboardDelay: (newValue: ClearClipboardDelaySetting) => Promise<void>;
}

export class AutofillSettingsService implements AutofillSettingsServiceAbstraction {
  private autofillOnPageLoadState: ActiveUserState<boolean>;
  readonly autofillOnPageLoad$: Observable<boolean>;

  private autofillOnPageLoadDefaultState: ActiveUserState<boolean>;
  readonly autofillOnPageLoadDefault$: Observable<boolean>;

  private autofillOnPageLoadCalloutIsDismissedState: ActiveUserState<boolean>;
  readonly autofillOnPageLoadCalloutIsDismissed$: Observable<boolean>;

  readonly activateAutofillOnPageLoadFromPolicy$: Observable<boolean>;

  private autofillOnPageLoadPolicyToastHasDisplayedState: ActiveUserState<boolean>;
  readonly autofillOnPageLoadPolicyToastHasDisplayed$: Observable<boolean>;

  private autoCopyTotpState: ActiveUserState<boolean>;
  readonly autoCopyTotp$: Observable<boolean>;

  private inlineMenuVisibilityState: GlobalState<InlineMenuVisibilitySetting>;
  readonly inlineMenuVisibility$: Observable<InlineMenuVisibilitySetting>;

  private showInlineMenuIdentitiesState: ActiveUserState<boolean>;
  readonly showInlineMenuIdentities$: Observable<boolean>;

  private showInlineMenuCardsState: ActiveUserState<boolean>;
  readonly showInlineMenuCards$: Observable<boolean>;

  private enableContextMenuState: GlobalState<boolean>;
  readonly enableContextMenu$: Observable<boolean>;

  private clearClipboardDelayState: ActiveUserState<ClearClipboardDelaySetting>;
  readonly clearClipboardDelay$: Observable<ClearClipboardDelaySetting>;

  constructor(
    private stateProvider: StateProvider,
    private policyService: PolicyService,
  ) {
    this.autofillOnPageLoadState = this.stateProvider.getActive(AUTOFILL_ON_PAGE_LOAD);
    this.autofillOnPageLoad$ = this.autofillOnPageLoadState.state$.pipe(map((x) => x ?? false));

    this.autofillOnPageLoadDefaultState = this.stateProvider.getActive(
      AUTOFILL_ON_PAGE_LOAD_DEFAULT,
    );
    this.autofillOnPageLoadDefault$ = this.autofillOnPageLoadDefaultState.state$.pipe(
      map((x) => x ?? true),
    );

    this.autofillOnPageLoadCalloutIsDismissedState = this.stateProvider.getActive(
      AUTOFILL_ON_PAGE_LOAD_CALLOUT_DISMISSED,
    );
    this.autofillOnPageLoadCalloutIsDismissed$ =
      this.autofillOnPageLoadCalloutIsDismissedState.state$.pipe(map((x) => x ?? false));

    this.activateAutofillOnPageLoadFromPolicy$ = this.policyService.policyAppliesToActiveUser$(
      PolicyType.ActivateAutofill,
    );

    this.autofillOnPageLoadPolicyToastHasDisplayedState = this.stateProvider.getActive(
      AUTOFILL_ON_PAGE_LOAD_POLICY_TOAST_HAS_DISPLAYED,
    );
    this.autofillOnPageLoadPolicyToastHasDisplayed$ =
      this.autofillOnPageLoadPolicyToastHasDisplayedState.state$.pipe(map((x) => x ?? false));

    this.autoCopyTotpState = this.stateProvider.getActive(AUTO_COPY_TOTP);
    this.autoCopyTotp$ = this.autoCopyTotpState.state$.pipe(map((x) => x ?? true));

    this.inlineMenuVisibilityState = this.stateProvider.getGlobal(INLINE_MENU_VISIBILITY);
    this.inlineMenuVisibility$ = this.inlineMenuVisibilityState.state$.pipe(
      map((x) => x ?? AutofillOverlayVisibility.Off),
    );

    this.showInlineMenuIdentitiesState = this.stateProvider.getActive(SHOW_INLINE_MENU_IDENTITIES);
    this.showInlineMenuIdentities$ = this.showInlineMenuIdentitiesState.state$.pipe(
      map((x) => x ?? true),
    );

    this.showInlineMenuCardsState = this.stateProvider.getActive(SHOW_INLINE_MENU_CARDS);
    this.showInlineMenuCards$ = this.showInlineMenuCardsState.state$.pipe(map((x) => x ?? true));

    this.enableContextMenuState = this.stateProvider.getGlobal(ENABLE_CONTEXT_MENU);
    this.enableContextMenu$ = this.enableContextMenuState.state$.pipe(map((x) => x ?? true));

    this.clearClipboardDelayState = this.stateProvider.getActive(CLEAR_CLIPBOARD_DELAY);
    this.clearClipboardDelay$ = this.clearClipboardDelayState.state$.pipe(
      map((x) => x ?? ClearClipboardDelay.Never),
    );
  }

  async setAutofillOnPageLoad(newValue: boolean): Promise<void> {
    await this.autofillOnPageLoadState.update(() => newValue);
  }

  async setAutofillOnPageLoadDefault(newValue: boolean): Promise<void> {
    await this.autofillOnPageLoadDefaultState.update(() => newValue);
  }

  async setAutofillOnPageLoadCalloutIsDismissed(newValue: boolean): Promise<void> {
    await this.autofillOnPageLoadCalloutIsDismissedState.update(() => newValue);
  }

  async setAutofillOnPageLoadPolicyToastHasDisplayed(newValue: boolean): Promise<void> {
    await this.autofillOnPageLoadPolicyToastHasDisplayedState.update(() => newValue);
  }

  async setAutoCopyTotp(newValue: boolean): Promise<void> {
    await this.autoCopyTotpState.update(() => newValue);
  }

  async setInlineMenuVisibility(newValue: InlineMenuVisibilitySetting): Promise<void> {
    await this.inlineMenuVisibilityState.update(() => newValue);
  }

  async setShowInlineMenuIdentities(newValue: boolean): Promise<void> {
    await this.showInlineMenuIdentitiesState.update(() => newValue);
  }

  async setShowInlineMenuCards(newValue: boolean): Promise<void> {
    await this.showInlineMenuCardsState.update(() => newValue);
  }

  async setEnableContextMenu(newValue: boolean): Promise<void> {
    await this.enableContextMenuState.update(() => newValue);
  }

  async setClearClipboardDelay(newValue: ClearClipboardDelaySetting): Promise<void> {
    await this.clearClipboardDelayState.update(() => newValue);
  }
}
