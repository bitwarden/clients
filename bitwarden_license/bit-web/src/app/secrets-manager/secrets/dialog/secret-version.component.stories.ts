import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { action } from "storybook/actions";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { SecretVersionView } from "../../models/view/secret-version.view";
import { SecretVersionHistory, SecretVersionService } from "../secret-version.service";
import { SecretService } from "../secret.service";

import {
  SecretVersionDialogComponent,
  SecretVersionDialogParams,
} from "./secret-version.component";

const ORGANIZATION_ID = "da0eea55-8604-4307-8a24-b187015e3071";
const SECRET_ID = "9f1b60ac-0f6c-4b9a-9b1a-0a0f6c1b60ac";

const params: SecretVersionDialogParams = {
  organizationId: ORGANIZATION_ID,
  secretId: SECRET_ID,
  name: "Production API Key",
  currentValue: "example-api-key-current-value",
  revisionDate: "2026-03-01T09:02:00.000Z",
  canWrite: true,
};

/** Newest first, matching the order the service returns. */
function previousVersions(withAuthors: boolean): SecretVersionView[] {
  return [
    new SecretVersionView({
      id: "version-3",
      secretId: SECRET_ID,
      value: "example-api-key-previous-value-3",
      versionDate: "2026-02-20T16:45:12.000Z",
      authorName: withAuthors ? "Ada Lovelace" : undefined,
    }),
    new SecretVersionView({
      id: "version-2",
      secretId: SECRET_ID,
      value: "example-api-key-previous-value-2",
      versionDate: "2026-02-03T11:20:45.000Z",
      authorName: withAuthors ? "ci-deploy" : undefined,
    }),
    new SecretVersionView({
      id: "version-1",
      secretId: SECRET_ID,
      value: "example-api-key-previous-value-1",
      versionDate: "2026-01-15T08:00:00.000Z",
      authorName: undefined,
    }),
  ];
}

const fullHistory: SecretVersionHistory = {
  currentValueAuthorName: "Grace Hopper",
  currentValueDate: params.revisionDate,
  versions: previousVersions(true),
};

/**
 * Per-story providers. Everything a story varies goes through here so the shared
 * decorators below stay fixed. Pass `"pending"` to hold the dialog in its loading state.
 */
function storyProviders(
  history: SecretVersionHistory | "pending",
  dialogParams: SecretVersionDialogParams = params,
) {
  return applicationConfig({
    providers: [
      { provide: DIALOG_DATA, useValue: dialogParams },
      {
        provide: SecretVersionService,
        useValue: {
          getSecretVersions: () =>
            history === "pending" ? new Promise<never>(() => {}) : Promise.resolve(history),
        },
      },
    ],
  });
}

export default {
  title: "Web/Secrets Manager/Secret Version Dialog",
  component: SecretVersionDialogComponent,
  decorators: [
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter([]),
        provideNoopAnimations(),
      ],
    }),
    moduleMetadata({
      imports: [SecretVersionDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close: action("DialogRef.close") } },
        { provide: ToastService, useValue: { showToast: action("ToastService.showToast") } },
        {
          provide: PlatformUtilsService,
          useValue: { copyToClipboard: action("PlatformUtilsService.copyToClipboard") },
        },
        { provide: LogService, useValue: { error: action("LogService.error") } },
        {
          provide: ValidationService,
          useValue: { showError: action("ValidationService.showError") },
        },
        {
          provide: SecretService,
          useValue: {
            // Restore re-reads the secret; hand back the same value so the card stays stable.
            getBySecretId: async () => ({
              value: params.currentValue,
              revisionDate: params.revisionDate,
            }),
            restoreVersion: async (secretId: string, versionId: string) => {
              action("SecretService.restoreVersion")(secretId, versionId);
            },
          },
        },
      ],
    }),
  ],
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
} as Meta<SecretVersionDialogComponent>;

type Story = StoryObj<SecretVersionDialogComponent>;

/** Current value plus three previous versions. Restore opens a real confirmation dialog. */
export const Default: Story = {
  decorators: [storyProviders(fullHistory)],
};

/** A secret that has only ever had one value, so the previous-versions section is empty. */
export const NoPreviousVersions: Story = {
  decorators: [storyProviders({ ...fullHistory, versions: [] })],
};

/** History from before editors were recorded; every author falls back to "Unknown". */
export const UnknownAuthors: Story = {
  decorators: [
    storyProviders({
      currentValueAuthorName: undefined,
      currentValueDate: params.revisionDate,
      versions: previousVersions(false),
    }),
  ],
};

/** A user with read-only access sees the history but cannot restore. */
export const ReadOnly: Story = {
  decorators: [storyProviders(fullHistory, { ...params, canWrite: false })],
};

/** The history request has not returned yet. */
export const Loading: Story = {
  decorators: [storyProviders("pending")],
};
