import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef } from "@bitwarden/components";

import { SmProjectMatch } from "../services/agent-access-secrets.service";

import {
  UpdateSecretRequestComponent,
  UpdateSecretRequestParams,
  UpdateSecretRequestResult,
} from "./update-secret-request.component";

const UserOne = "user-1" as UserId;

function makeParams(overrides: Partial<UpdateSecretRequestParams> = {}): UpdateSecretRequestParams {
  return {
    secretName: "DB_PASSWORD",
    changes: {},
    userId: UserOne,
    ...overrides,
  };
}

describe("UpdateSecretRequestComponent", () => {
  let mockDialogRef: MockProxy<DialogRef<UpdateSecretRequestResult>>;
  let mockI18nService: MockProxy<I18nService>;

  beforeEach(() => {
    mockDialogRef = mock<DialogRef<UpdateSecretRequestResult>>();
    mockI18nService = mock<I18nService>();
    mockI18nService.t.mockImplementation((key: string) => key);
  });

  function createComponent(params: UpdateSecretRequestParams): UpdateSecretRequestComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: DIALOG_DATA, useValue: params },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: I18nService, useValue: mockI18nService },
      ],
    });

    return TestBed.runInInjectionContext(() => new UpdateSecretRequestComponent());
  }

  describe("project picker visibility", () => {
    it("hides the picker when no project move was proposed", () => {
      const component = createComponent(makeParams({ changes: {} }));
      expect(component["showProjectPicker"]()).toBe(false);
    });

    it("shows the picker when a project move was proposed", () => {
      const component = createComponent(makeParams({ changes: { project: { toHint: "my-app" } } }));
      expect(component["showProjectPicker"]()).toBe(true);
    });
  });

  describe("submit", () => {
    it("approves with no projectId when no move was proposed", async () => {
      const component = createComponent(makeParams({ changes: { name: { from: "A", to: "B" } } }));

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, projectId: undefined });
    });

    it("approves with no projectId when a move was proposed but the user left it at 'do not move'", async () => {
      const component = createComponent(
        makeParams({
          changes: { project: { toHint: "my-app" } },
          writableProjects: [{ id: "proj-1", name: "my-app", write: true } as SmProjectMatch],
        }),
      );

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, projectId: undefined });
    });

    it("approves with the preselected projectId when the hint matched a writable project", async () => {
      const component = createComponent(
        makeParams({
          changes: { project: { toHint: "my-app" } },
          writableProjects: [{ id: "proj-1", name: "my-app", write: true } as SmProjectMatch],
          preselectedProjectId: "proj-1",
        }),
      );

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, projectId: "proj-1" });
    });

    it("approves with an explicitly-picked projectId, overriding the preselect", async () => {
      const component = createComponent(
        makeParams({
          changes: { project: { toHint: "my-app" } },
          writableProjects: [
            { id: "proj-1", name: "my-app", write: true } as SmProjectMatch,
            { id: "proj-2", name: "other-app", write: true } as SmProjectMatch,
          ],
          preselectedProjectId: "proj-1",
        }),
      );
      component["updateSecretRequestForm"].patchValue({ projectId: "proj-2" });

      await component.submit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: true, projectId: "proj-2" });
    });
  });

  describe("deny", () => {
    it("closes with approved: false", async () => {
      const component = createComponent(makeParams());

      await component.deny();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ approved: false });
    });
  });

  describe("requesterDisplayName", () => {
    it("falls back to a shortened fingerprint when no requester name is present", () => {
      const component = createComponent(makeParams({ requesterFingerprint: "abcdef123456" }));

      expect(component["requesterDisplayName"]).toBe("ABCDEF…");
    });
  });
});
