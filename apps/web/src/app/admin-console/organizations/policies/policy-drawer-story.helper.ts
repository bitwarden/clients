import { importProvidersFrom } from "@angular/core";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
} from "@storybook/angular";
import { of } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyStatusResponse } from "@bitwarden/common/admin-console/models/response/policy-status.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { BasePolicyEditDefinition } from "./base-policy-edit.component";
import { PolicyEditDialogData } from "./policy-edit-dialog.component";
import { PolicyEditDrawerComponent } from "./policy-edit-drawer.component";

const ORG_ID = "test-org-id";

export type PolicyDrawerStoryArgs = { enabled: boolean };

/**
 * Generates shared Storybook metadata for a policy drawer story.
 * Renders {@link PolicyEditDrawerComponent} with all required service mocks.
 * Per-story args drive the initial enabled state via the {@link PolicyApiServiceAbstraction} mock.
 */
export function policyDrawerMeta(
  title: string,
  policy: BasePolicyEditDefinition,
): Meta<PolicyDrawerStoryArgs> {
  return {
    title,
    component: PolicyEditDrawerComponent,
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
