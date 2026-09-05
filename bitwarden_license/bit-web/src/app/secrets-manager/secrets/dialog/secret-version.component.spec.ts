import { Signal, WritableSignal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DIALOG_DATA, DialogRef, DialogService, ToastService } from "@bitwarden/components";

import { SecretVersionView } from "../../models/view/secret-version.view";
import { SecretView } from "../../models/view/secret.view";
import { SecretVersionHistory, SecretVersionService } from "../secret-version.service";
import { SecretService } from "../secret.service";

import {
  SecretVersionDialogComponent,
  SecretVersionDialogParams,
} from "./secret-version.component";

/**
 * The component keeps its state `protected` so only its template can reach it. The suite drives
 * that same surface through a structural view of it rather than loosening the component's own
 * visibility modifiers.
 */
interface VersionRow {
  id: string;
  value: string;
  date: Date | null;
  author: string | null;
  copy: () => Promise<void>;
  toggleVisibility: () => Promise<void>;
  restore: () => Promise<void>;
}

interface DialogInternals {
  loading: WritableSignal<boolean>;
  rows: WritableSignal<VersionRow[]>;
  visibleVersionIds: WritableSignal<Set<string>>;
  expandedVersionIds: WritableSignal<Set<string>>;
  currentValueVisible: WritableSignal<boolean>;
  currentValue: WritableSignal<string | null>;
  revisionDate: WritableSignal<Date | null>;
  currentValueAuthor: WritableSignal<string | null>;
  hasCurrentValue: Signal<boolean>;
  hasVersions: Signal<boolean>;
  isEmpty: Signal<boolean>;
  maskedValue: string;
  name?: string;
  canWrite: boolean;
  toggleCurrentValueVisibility: () => Promise<void>;
  copyCurrentValue: () => Promise<void>;
  setVersionExpanded: (versionId: string, expanded: boolean) => void;
}

const internals = (component: SecretVersionDialogComponent) =>
  component as unknown as DialogInternals;

function makeVersion(overrides: Partial<SecretVersionView> = {}): SecretVersionView {
  const version = new SecretVersionView();
  version.id = overrides.id ?? "version-1";
  version.secretId = overrides.secretId ?? "secret-1";
  version.value = overrides.value ?? "old-value";
  version.versionDate = overrides.versionDate ?? "2026-01-27T14:15:32.000Z";
  version.authorName = overrides.authorName;
  return version;
}

function makeSecret(value: string, revisionDate: string): SecretView {
  const secret = new SecretView();
  secret.value = value;
  secret.revisionDate = revisionDate;
  return secret;
}

describe("SecretVersionDialogComponent", () => {
  let fixture: ComponentFixture<SecretVersionDialogComponent>;
  let component: SecretVersionDialogComponent;

  let i18nService: MockProxy<I18nService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let toastService: MockProxy<ToastService>;
  let logService: MockProxy<LogService>;
  let validationService: MockProxy<ValidationService>;
  let secretVersionService: MockProxy<SecretVersionService>;
  let secretService: MockProxy<SecretService>;
  let dialogService: MockProxy<DialogService>;

  const PARAMS: SecretVersionDialogParams = {
    organizationId: "org-1",
    secretId: "secret-1",
    name: "Production API Key",
    currentValue: "current-value",
    revisionDate: "2026-01-27T15:30:45.000Z",
    canWrite: true,
  };

  /**
   * Builds the component with `params`, runs `ngOnInit`, and returns its internal state.
   * Pass an `Error` as `history` to exercise the failure path.
   */
  async function setup(
    params: SecretVersionDialogParams = PARAMS,
    history: SecretVersionHistory | Error = { currentValueAuthorName: "User", versions: [] },
  ) {
    if (history instanceof Error) {
      secretVersionService.getSecretVersions.mockRejectedValue(history);
    } else {
      secretVersionService.getSecretVersions.mockResolvedValue(history);
    }

    await TestBed.configureTestingModule({
      imports: [SecretVersionDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mock<DialogRef>() },
        { provide: I18nService, useValue: i18nService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
        { provide: ValidationService, useValue: validationService },
        { provide: SecretVersionService, useValue: secretVersionService },
        { provide: SecretService, useValue: secretService },
        { provide: DialogService, useValue: dialogService },
      ],
    })
      .overrideComponent(SecretVersionDialogComponent, { set: { template: "" } })
      // `DialogModule` declares `providers: [DialogService]` and the component imports it, so a
      // plain TestBed provider is shadowed by the module's. `overrideProvider` reaches it.
      .overrideProvider(DialogService, { useValue: dialogService })
      .compileComponents();

    fixture = TestBed.createComponent(SecretVersionDialogComponent);
    component = fixture.componentInstance;
    await component.ngOnInit();
    return internals(component);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();

    i18nService = mock<I18nService>();
    platformUtilsService = mock<PlatformUtilsService>();
    toastService = mock<ToastService>();
    logService = mock<LogService>();
    validationService = mock<ValidationService>();
    secretVersionService = mock<SecretVersionService>();
    secretService = mock<SecretService>();
    dialogService = mock<DialogService>();

    i18nService.t.mockImplementation((key: string) => key);
  });

  describe("initialization", () => {
    it("seeds the current value and revision date from the dialog params", async () => {
      const state = await setup();

      expect(state.currentValue()).toBe("current-value");
      expect(state.revisionDate()).toEqual(new Date("2026-01-27T15:30:45.000Z"));
      expect(state.name).toBe("Production API Key");
    });

    it("requests history for the organization and secret named in the params", async () => {
      await setup();

      expect(secretVersionService.getSecretVersions).toHaveBeenCalledWith("org-1", "secret-1");
    });

    it("clears the loading flag once history resolves", async () => {
      const state = await setup();

      expect(state.loading()).toBe(false);
    });

    it("maps history entries onto rows, preserving the order the service returned", async () => {
      const state = await setup(PARAMS, {
        currentValueAuthorName: "User",
        versions: [
          makeVersion({ id: "v2", value: "second", versionDate: "2026-01-27T14:15:32.000Z" }),
          makeVersion({ id: "v1", value: "first", versionDate: "2026-01-26T16:00:22.000Z" }),
        ],
      });

      expect(state.rows().map((row) => row.id)).toEqual(["v2", "v1"]);
      expect(state.rows()[0].value).toBe("second");
      expect(state.rows()[0].date).toEqual(new Date("2026-01-27T14:15:32.000Z"));
    });

    it("exposes the author name reported for the current value", async () => {
      const state = await setup(PARAMS, { currentValueAuthorName: "Ada", versions: [] });

      expect(state.currentValueAuthor()).toBe("Ada");
    });

    it("falls back to a null author when history omits one", async () => {
      const state = await setup(PARAMS, { versions: [] });

      expect(state.currentValueAuthor()).toBeNull();
      expect(state.rows()).toEqual([]);
    });

    it("still renders a secret whose value is an empty string", async () => {
      const state = await setup({ ...PARAMS, currentValue: "" });

      expect(state.hasCurrentValue()).toBe(true);
      expect(state.isEmpty()).toBe(false);
    });

    it("reports empty when there is neither a current value nor any history", async () => {
      const state = await setup({ ...PARAMS, currentValue: undefined });

      expect(state.hasCurrentValue()).toBe(false);
      expect(state.hasVersions()).toBe(false);
      expect(state.isEmpty()).toBe(true);
    });

    it("surfaces a load failure without leaving the dialog spinning", async () => {
      const error = new Error("boom");

      const state = await setup(PARAMS, error);

      expect(logService.error).toHaveBeenCalledWith("Retrieving secret versions failed", error);
      expect(validationService.showError).toHaveBeenCalledWith(error);
      expect(state.loading()).toBe(false);
    });

    it("defaults canWrite to true when the param is omitted", async () => {
      const state = await setup({ ...PARAMS, canWrite: undefined });

      expect(state.canWrite).toBe(true);
    });

    it("honours canWrite when the param denies writes", async () => {
      const state = await setup({ ...PARAMS, canWrite: false });

      expect(state.canWrite).toBe(false);
    });
  });

  describe("expansion", () => {
    it("marks a version expanded", async () => {
      const state = await setup();

      state.setVersionExpanded("v1", true);

      expect(state.expandedVersionIds().has("v1")).toBe(true);
    });

    it("leaves other expanded versions open, so several can be expanded at once", async () => {
      const state = await setup();

      state.setVersionExpanded("v1", true);
      state.setVersionExpanded("v2", true);

      expect([...state.expandedVersionIds()].sort()).toEqual(["v1", "v2"]);
    });

    it("re-hides a revealed value when its version collapses", async () => {
      const state = await setup();
      state.setVersionExpanded("v1", true);
      state.visibleVersionIds.set(new Set(["v1", "v2"]));

      state.setVersionExpanded("v1", false);

      expect(state.expandedVersionIds().has("v1")).toBe(false);
      expect(state.visibleVersionIds().has("v1")).toBe(false);
      // Another version's revealed value is left alone.
      expect(state.visibleVersionIds().has("v2")).toBe(true);
    });

    it("replaces the Set rather than mutating it, so OnPush sees the change", async () => {
      const state = await setup();
      const before = state.expandedVersionIds();

      state.setVersionExpanded("v1", true);

      expect(state.expandedVersionIds()).not.toBe(before);
    });
  });

  describe("value visibility", () => {
    it("toggles the current value between hidden and revealed", async () => {
      const state = await setup();

      expect(state.currentValueVisible()).toBe(false);
      await state.toggleCurrentValueVisibility();
      expect(state.currentValueVisible()).toBe(true);
      await state.toggleCurrentValueVisibility();
      expect(state.currentValueVisible()).toBe(false);
    });

    it("toggles one version's value without touching its neighbours", async () => {
      const state = await setup(PARAMS, {
        versions: [makeVersion({ id: "v1" }), makeVersion({ id: "v2" })],
      });

      await state.rows()[0].toggleVisibility();

      expect(state.visibleVersionIds().has("v1")).toBe(true);
      expect(state.visibleVersionIds().has("v2")).toBe(false);

      await state.rows()[0].toggleVisibility();

      expect(state.visibleVersionIds().has("v1")).toBe(false);
    });

    it("masks with a fixed-length stand-in that leaks neither the value nor its length", async () => {
      const state = await setup();

      expect(state.maskedValue).toBe("•".repeat(16));
      expect(state.maskedValue).not.toContain("current-value");
    });
  });

  describe("copying", () => {
    it("copies the current value and confirms with a toast", async () => {
      const state = await setup();

      await state.copyCurrentValue();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("current-value");
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "secretValueCopied" }),
      );
    });

    it("copies an empty string when there is no current value", async () => {
      const state = await setup({ ...PARAMS, currentValue: undefined });

      await state.copyCurrentValue();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("");
    });

    it("copies a previous version's value", async () => {
      const state = await setup(PARAMS, {
        versions: [makeVersion({ id: "v1", value: "old-value" })],
      });

      await state.rows()[0].copy();

      expect(platformUtilsService.copyToClipboard).toHaveBeenCalledWith("old-value");
    });
  });

  describe("restore", () => {
    const historyWithOneVersion: SecretVersionHistory = {
      currentValueAuthorName: "User",
      versions: [makeVersion({ id: "v1", value: "old-value" })],
    };

    it("does nothing when the confirmation prompt is declined", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);
      const state = await setup(PARAMS, historyWithOneVersion);

      await state.rows()[0].restore();

      expect(secretService.restoreVersion).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("restores the version and confirms with a toast once accepted", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      secretService.getBySecretId.mockResolvedValue(
        makeSecret("restored-value", "2026-01-28T09:00:00.000Z"),
      );

      const state = await setup(PARAMS, historyWithOneVersion);
      await state.rows()[0].restore();

      expect(secretService.restoreVersion).toHaveBeenCalledWith("secret-1", "v1");
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "secretVersionRestored" }),
      );
    });

    it("re-reads the secret afterwards so the current value reflects the restore", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      secretService.getBySecretId.mockResolvedValue(
        makeSecret("restored-value", "2026-01-28T09:00:00.000Z"),
      );

      const state = await setup(PARAMS, historyWithOneVersion);
      await state.rows()[0].restore();

      expect(secretService.getBySecretId).toHaveBeenCalledWith("secret-1");
      expect(state.currentValue()).toBe("restored-value");
      expect(state.revisionDate()).toEqual(new Date("2026-01-28T09:00:00.000Z"));
    });

    it("collapses and re-hides every version after a restore", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      secretService.getBySecretId.mockResolvedValue(
        makeSecret("restored-value", "2026-01-28T09:00:00.000Z"),
      );

      const state = await setup(PARAMS, historyWithOneVersion);
      state.setVersionExpanded("v1", true);
      await state.rows()[0].toggleVisibility();
      state.currentValueVisible.set(true);

      await state.rows()[0].restore();

      expect(state.expandedVersionIds().size).toBe(0);
      expect(state.visibleVersionIds().size).toBe(0);
      expect(state.currentValueVisible()).toBe(false);
    });

    it("surfaces a restore failure instead of showing a success toast", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      const error = new Error("nope");
      secretService.restoreVersion.mockRejectedValue(error);

      const state = await setup(PARAMS, historyWithOneVersion);
      await state.rows()[0].restore();

      expect(logService.error).toHaveBeenCalledWith("secret restoration failed", error);
      expect(validationService.showError).toHaveBeenCalledWith(error);
      expect(toastService.showToast).not.toHaveBeenCalled();
    });
  });
});
