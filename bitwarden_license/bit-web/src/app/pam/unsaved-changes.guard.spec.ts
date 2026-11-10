import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, CanDeactivateFn, RouterStateSnapshot } from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DialogService } from "@bitwarden/components";

import { HasUnsavedChangesDialog, unsavedChangesDialogGuard } from "./unsaved-changes.guard";

describe("unsaved changes guard", () => {
  const DISCARD_DIALOG = {
    title: { key: "discardEditsTitle" },
    content: { key: "discardEditsConfirmation" },
    acceptButtonText: { key: "discardEdits" },
    cancelButtonText: { key: "backToEditing" },
    type: "danger",
    hideIcon: true,
  };

  let status$: BehaviorSubject<AuthenticationStatus>;
  let dialogService: MockProxy<DialogService>;

  beforeEach(() => {
    status$ = new BehaviorSubject<AuthenticationStatus>(AuthenticationStatus.Unlocked);
    dialogService = mock<DialogService>();
    dialogService.openSimpleDialog.mockResolvedValue(false);

    const authService = mock<AuthService>();
    authService.activeAccountStatus$ = status$;

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: DialogService, useValue: dialogService },
      ],
    });
  });

  function run<T>(guard: CanDeactivateFn<T>, target: T | null): Promise<boolean> {
    return TestBed.runInInjectionContext(
      () =>
        guard(
          target as T,
          mock<ActivatedRouteSnapshot>(),
          mock<RouterStateSnapshot>(),
          mock<RouterStateSnapshot>(),
        ) as Promise<boolean>,
    );
  }

  describe("unsavedChangesDialogGuard", () => {
    const reporting = (
      changes: ReturnType<HasUnsavedChangesDialog["unsavedChanges"]>,
    ): HasUnsavedChangesDialog => ({ unsavedChanges: () => changes });

    it("leaves without asking when nothing is unsaved", async () => {
      await expect(run(unsavedChangesDialogGuard, reporting(false))).resolves.toBe(true);
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("asks with the default discard dialog and follows the answer", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await expect(run(unsavedChangesDialogGuard, reporting(true))).resolves.toBe(true);
      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith(DISCARD_DIALOG);
    });

    it("stays when the user keeps editing", async () => {
      await expect(run(unsavedChangesDialogGuard, reporting(true))).resolves.toBe(false);
    });

    it("lays the component's options over the default dialog", async () => {
      await run(unsavedChangesDialogGuard, reporting({ title: { key: "customTitle" } }));

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        ...DISCARD_DIALOG,
        title: { key: "customTitle" },
      });
    });

    it.each([
      ["locked", AuthenticationStatus.Locked],
      ["logged out", AuthenticationStatus.LoggedOut],
    ])("lets the navigation through without asking when the account is %s", async (_, status) => {
      status$.next(status);

      await expect(run(unsavedChangesDialogGuard, reporting(true))).resolves.toBe(true);
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
    });

    it("lets the navigation through when Angular passes no component", async () => {
      await expect(run(unsavedChangesDialogGuard, null)).resolves.toBe(true);
    });
  });
});
