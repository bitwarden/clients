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
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { EncryptService } from "@bitwarden/legacy-crypto";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { BasePolicyEditDefinition } from "./base-policy-edit.component";
import { PolicyEditDialogData, PolicyEditDrawerComponent } from "./policy-edit-drawer.component";

const ORG_ID = "test-org-id";

export type PolicyDialogStoryArgs = { enabled: boolean };

/** @deprecated Use {@link PolicyDialogStoryArgs}. Kept as an alias for existing story files. */
export type PolicyDrawerStoryArgs = PolicyDialogStoryArgs;

/**
 * Generates shared Storybook metadata for a policy's drawer story. Renders whichever dialog
 * component the policy actually uses: the framework default ({@link PolicyEditDrawerComponent})
 * unless the policy sets a custom `editDialogComponent` (e.g. `MultiStepPolicyEditDialogComponent`).
 *
 * Per-story args drive the initial enabled state via the {@link PolicyApiServiceAbstraction} mock.
 *
 * Deliberately does NOT set `title`: Storybook v7+ statically analyzes each story file's default
 * export to build the sidebar, and it can't evaluate a spread of a function call. Every story file
 * using this helper MUST set `title` as a literal string directly on its own default export (after
 * the spread), e.g.:
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
  const dialogComponent: Type<unknown> =
    (policy.editDialogComponent as unknown as Type<unknown>) ?? PolicyEditDrawerComponent;

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
      componentWrapperDecorator(
        (story) =>
          `<div class="tw-h-screen tw-flex tw-flex-row tw-bg-background">` +
          `<div class="tw-flex-1 tw-p-8 tw-bg-background-alt tw-text-muted">` +
          `<p>Policy management view</p>` +
          `</div>` +
          `<div class="tw-w-[32rem] tw-h-full tw-flex tw-flex-col tw-border-0 tw-border-l tw-border-solid tw-border-secondary-300">` +
          `${story}` +
          `</div>` +
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
            useValue: { isDrawer: true, close: () => Promise.resolve(), closePredicate: undefined },
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
