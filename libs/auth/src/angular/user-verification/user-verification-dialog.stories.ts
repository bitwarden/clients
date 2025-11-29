import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { importProvidersFrom } from "@angular/core";
import { NoopAnimationsModule } from "@angular/platform-browser/animations";
// import { action } from "@storybook/addon-actions";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { delay, firstValueFrom, of } from "rxjs";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { UserVerificationOptions } from "@bitwarden/common/auth/types/user-verification-options";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { PreloadedEnglishI18nModule } from "../../../../../apps/web/src/app/core/tests/preloaded-english-i18n.module";

import { UserVerificationDialogComponent } from "./user-verification-dialog.component";
import { UserVerificationDialogOptions } from "./user-verification-dialog.types";

export default {
  title: "Auth/User Verification Dialog",
  component: UserVerificationDialogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule, NoopAnimationsModule)],
    }),
  ],
} as Meta;

const mockUserVerificationDialog = (
  dialogOptions: UserVerificationDialogOptions,
  availableVerificationOptions: UserVerificationOptions,
) =>
  moduleMetadata({
    imports: [],
    providers: [
      {
        provide: DIALOG_DATA,
        useValue: dialogOptions,
      },
      {
        provide: DialogRef,
        useValue: {
          close(result, _options) {
            // `action` isn't working in `moduleMetadata`
            // action(`close dialog: ${result}`);

            // eslint-disable-next-line no-console
            console.log(`close dialog: ${JSON.stringify(result)}`);
          },
        } as Partial<DialogRef>,
      },
      {
        provide: UserVerificationService,
        useValue: {
          verifyUser(verification) {
            return firstValueFrom(of(true).pipe(delay(2000)));
          },
          getAvailableVerificationOptions(verificationType) {
            return Promise.resolve(availableVerificationOptions);
          },
        } as Partial<UserVerificationService>,
      },
      {
        provide: PlatformUtilsService,
        useValue: {
          showToast(type, title, text, options) {
            // `action` isn't working in `moduleMetadata`
            // action(`showToast`);

            // eslint-disable-next-line no-console
            console.log(`showToast`);
          },
        } as Partial<PlatformUtilsService>,
      },
    ],
  });

type Story = StoryObj<UserVerificationDialogComponent>;

export const ClientSideOnlyAllOptions: Story = {
  name: "Client Side Only: All Options",
  decorators: [
    mockUserVerificationDialog(
      { clientSideOnlyVerification: true },
      {
        client: {
          biometrics: true,
          masterPassword: true,
          pin: true,
        },
        server: {
          masterPassword: true,
          otp: true,
        },
      },
    ),
  ],
};

export const ClientSideOnlyWithMasterPasswordOnly: Story = {
  name: "Client Side Only: With Master Password Only",
  decorators: [
    mockUserVerificationDialog(
      { clientSideOnlyVerification: true },
      {
        client: {
          biometrics: false,
          masterPassword: true,
          pin: false,
        },
        server: {
          masterPassword: false,
          otp: false,
        },
      },
    ),
  ],
};

export const ClientSideOnlyExportDialog: Story = {
  name: "Client Side Only: Export Dialog",
  decorators: [
    mockUserVerificationDialog(
      {
        title: "confirmVaultExport",
        clientSideOnlyVerification: true,
        bodyText: "exportWarningDesc",
        confirmButtonOptions: {
          text: "exportVault",
          type: "primary",
        },
      },
      {
        client: {
          biometrics: true,
          masterPassword: true,
          pin: true,
        },
        server: {
          masterPassword: true,
          otp: true,
        },
      },
    ),
  ],
};

export const ServerSideAllOptions: Story = {
  name: "Server Side Only: All Options",
  decorators: [
    mockUserVerificationDialog(
      {},
      {
        client: {
          biometrics: false,
          masterPassword: false,
          pin: false,
        },
        server: {
          masterPassword: true,
          otp: true,
        },
      },
    ),
  ],
};
