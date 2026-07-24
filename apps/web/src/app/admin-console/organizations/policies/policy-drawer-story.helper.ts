import { importProvidersFrom, Type } from "@angular/core";
import { Router } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
} from "@storybook/angular";
import { of } from "rxjs";

import { AutoConfirmState, AutomaticUserConfirmationService } from "@bitwarden/auto-confirm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { BasePolicyEditDefinition } from "./base-policy-edit.component";
import { PolicyEditDialogComponent, PolicyEditDialogData } from "./policy-edit-dialog.component";
import { PolicyEditDrawerComponent } from "./policy-edit-drawer.component";

const ORG_ID = "test-org-id";

export type PolicyDialogStoryArgs = { enabled: boolean };

/** @deprecated Use {@link PolicyDialogStoryArgs}. Kept as an alias for existing story files. */
export type PolicyDrawerStoryArgs = PolicyDialogStoryArgs;

/**
 * Shared builder behind {@link policyDrawerMeta} and {@link policyModalMeta}. Renders whichever
 * dialog component the policy actually uses for the given mode:
 * - Most policies use the framework defaults ({@link PolicyEditDrawerComponent} for the drawer,
 *   {@link PolicyEditDialogComponent} for the modal) - two entirely separate component classes,
 *   so a v2-only design change structurally cannot leak into the modal story.
 * - A few policies (e.g. `MasterPasswordPolicy`) set a custom `editDialogComponent` (like
 *   `MultiStepPolicyEditDialogComponent`) that serves *both* the modal and drawer experiences
 *   from a single component, gated internally on `DialogRef.isDrawer`. Rendering that same
 *   component with `isDrawer: false` here is exactly what catches a regression like a badge or
 *   v2 component leaking into the modal when the `PolicyDrawers` flag is off.
 *
 * Deliberately does NOT set `title`: Storybook v7+ statically analyzes each story file's default
 * export to build the sidebar, and it can't evaluate a spread of a function call. Every story file
 * using this helper MUST set `title` as a literal string directly on its own default export (after
 * the spread), or Storybook silently falls back to a file-path-based title - which is exactly how
 * we ended up with policies scattered across two different sidebar locations.
 */
function buildPolicyDialogMeta(
  policy: BasePolicyEditDefinition,
  isDrawer: boolean,
): Omit<Meta<PolicyDialogStoryArgs>, "title"> {
  const dialogComponent: Type<unknown> =
    (policy.editDialogComponent as unknown as Type<unknown>) ??
    (isDrawer ? PolicyEditDrawerComponent : PolicyEditDialogComponent);

  return {
    component: dialogComponent,
    args: { enabled: false },
    argTypes: {
      enabled: { control: "boolean" },
    },
    parameters: {
      layout: "fullscreen",
    },
    decorators: [
      componentWrapperDecorator((story) =>
        isDrawer
          ? `<div class="tw-h-screen tw-flex tw-flex-row tw-bg-background">` +
            `<div class="tw-flex-1 tw-p-8 tw-bg-background-alt tw-text-muted">` +
            `<p>Policy management view</p>` +
            `</div>` +
            `<div class="tw-w-[32rem] tw-h-full tw-flex tw-flex-col tw-border-0 tw-border-l tw-border-solid tw-border-secondary-300">` +
            `${story}` +
            `</div>` +
            `</div>`
          : `<div class="tw-h-screen tw-flex tw-items-center tw-justify-center tw-bg-background-alt">` +
            `${story}` +
            `</div>`,
      ),
      moduleMetadata({
        providers: [
          {
            provide: DIALOG_DATA,
            useValue: { policy, organization: { id: ORG_ID } } as PolicyEditDialogData,
          },
          {
            provide: DialogRef,
            useValue: { isDrawer, close: () => Promise.resolve(), closePredicate: undefined },
          },
          {
            provide: AccountService,
            useValue: {
              activeAccount$: of({
                id: "test-user-id" as UserId,
                email: "user@example.com",
              } as any),
            },
          },
          {
            provide: AuthService,
            useValue: {
              authStatusFor$: () => of(AuthenticationStatus.Unlocked),
            },
          },
          {
            provide: ToastService,
            useValue: { showToast: () => {} },
          },
          {
            provide: KeyService,
            useValue: { orgKeys$: () => of({}) },
          },
          {
            provide: DialogService,
            useValue: { openSimpleDialog: () => Promise.resolve(false) },
          },
          {
            provide: OrganizationService,
            useValue: { organizations$: () => of([]) },
          },
          {
            // Only policies with additional metadata to encrypt (e.g. OrganizationDataOwnershipPolicy's
            // default user collection name) inject this, but providing it unconditionally is harmless
            // for every other policy.
            provide: EncryptService,
            useValue: { encryptString: () => Promise.resolve({ encryptedString: "encrypted" }) },
          },
          {
            // Only PolicyEditDialogComponent/MultiStepPolicyEditDialogComponent inject this
            // directly, but providing it unconditionally is harmless for the drawer component.
            provide: ConfigService,
            useValue: { getFeatureFlag$: () => of(isDrawer) },
          },
          {
            // Only AutoConfirmPolicy's component injects these, but providing them
            // unconditionally is harmless for every other policy. Without these, Angular throws
            // a NullInjectorError while creating the policy form component, which is swallowed by
            // the dialog's async ngAfterViewInit and leaves the step body empty with no visible
            // error in the story.
            provide: PolicyService,
            useValue: { policies$: () => of([]) },
          },
          {
            provide: AutomaticUserConfirmationService,
            useValue: {
              configuration$: () => of(new AutoConfirmState()),
              upsert: () => Promise.resolve(),
            },
          },
          {
            provide: Router,
            useValue: { navigate: () => Promise.resolve(true) },
          },
        ],
      }),
      applicationConfig({
        providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
      }),
    ],
    render: (args) => ({
      moduleMetadata: {
        providers: [
          {
            provide: PolicyApiServiceAbstraction,
            useValue: {
              getPolicy: () =>
                Promise.resolve(
                  new PolicyStatusResponse({
                    OrganizationId: ORG_ID,
                    Type: policy.type,
                    Data: null,
                    Enabled: args.enabled,
                    CanToggleState: true,
                  }),
                ),
              putPolicy: () => Promise.resolve(),
            },
          },
        ],
      },
    }),
  };
}

/**
 * Generates shared Storybook metadata for a policy's drawer story (`PolicyDrawers` flag on).
 * Per-story args drive the initial enabled state via the {@link PolicyApiServiceAbstraction} mock.
 *
 * IMPORTANT: the caller's default export MUST also set a literal `title` (see note on
 * {@link buildPolicyDialogMeta}), e.g.:
 * ```ts
 * export default {
 *   ...policyDrawerMeta(new MyPolicy()),
 *   title: "Admin Console/Organizations/Policies/My Policy",
 * } satisfies Meta<PolicyDialogStoryArgs>;
 * ```
 */
export function policyDrawerMeta(
  policy: BasePolicyEditDefinition,
): Omit<Meta<PolicyDialogStoryArgs>, "title"> {
  return buildPolicyDialogMeta(policy, true);
}

/**
 * Generates shared Storybook metadata for a policy's modal story (`PolicyDrawers` flag off - the
 * default, pre-existing experience). Pair this with {@link policyDrawerMeta} for every policy that
 * has a `v2` component, so a visual diff (e.g. via Chromatic) catches any v2-only design change
 * (badge, component, description, etc.) leaking into the modal when the flag is off.
 *
 * IMPORTANT: the caller's default export MUST also set a literal `title` (see note on
 * {@link buildPolicyDialogMeta}).
 */
export function policyModalMeta(
  policy: BasePolicyEditDefinition,
): Omit<Meta<PolicyDialogStoryArgs>, "title"> {
  return buildPolicyDialogMeta(policy, false);
}
