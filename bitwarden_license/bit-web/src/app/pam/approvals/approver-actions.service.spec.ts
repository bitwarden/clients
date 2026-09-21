import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { DECIDE_ACCESS_SERVER_ERRORS } from "../helpers/decide-access-error";

import { ApproverActionsService, rowBusy } from "./approver-actions.service";
import { DecideDialogComponent, DecideDialogParams } from "./decide-dialog/decide-dialog.component";

describe("ApproverActionsService", () => {
  let service: ApproverActionsService;
  let dialogService: MockProxy<DialogService>;
  let toastService: MockProxy<ToastService>;
  let logService: MockProxy<LogService>;
  let run: jest.Mock;
  let busy: jest.Mock;

  const params = { verdict: "approve", row: { id: "req-1" } } as unknown as DecideDialogParams;

  /** The decide dialog closing as the approver left it. */
  function decideDialogCloses(result: unknown): void {
    dialogService.open.mockReturnValue({ closed: of(result) } as never);
  }

  beforeEach(() => {
    dialogService = mock<DialogService>();
    toastService = mock<ToastService>();
    logService = mock<LogService>();
    run = jest.fn().mockResolvedValue(undefined);
    busy = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        ApproverActionsService,
        { provide: DialogService, useValue: dialogService },
        { provide: ToastService, useValue: toastService },
        { provide: LogService, useValue: logService },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });
    service = TestBed.inject(ApproverActionsService);
  });

  describe("decide", () => {
    it("opens the decide dialog on the given request", async () => {
      decideDialogCloses(undefined);

      await service.decide(params, run, busy);

      expect(dialogService.open).toHaveBeenCalledWith(DecideDialogComponent, { data: params });
    });

    it("records the verdict the dialog closed with, not the one it opened on", async () => {
      decideDialogCloses({ confirmed: true, verdict: "deny", comment: "wrong window" });

      await service.decide(params, run, busy);

      expect(run).toHaveBeenCalledWith("deny", "wrong window");
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxDeniedToast",
      });
    });

    it("toasts an approval as approved", async () => {
      decideDialogCloses({ confirmed: true, verdict: "approve", comment: undefined });

      await service.decide(params, run, busy);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxApprovedToast",
      });
    });

    it("records nothing, and never goes busy, when the dialog is dismissed", async () => {
      decideDialogCloses(undefined);

      await service.decide(params, run, busy);

      expect(run).not.toHaveBeenCalled();
      expect(busy).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("logs and toasts a failed decision", async () => {
      const error = new Error("boom");
      run.mockRejectedValue(error);
      decideDialogCloses({ confirmed: true, verdict: "approve", comment: undefined });

      await service.decide(params, run, busy);

      expect(logService.error).toHaveBeenCalledWith(error);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxDecisionFailed",
      });
    });

    it("toasts a request that is no longer pending in its own words", async () => {
      run.mockRejectedValue(
        Object.assign(new Error(DECIDE_ACCESS_SERVER_ERRORS.AlreadyResolved.serverMessage), {
          name: "ApprovalError",
          variant: "Api",
        }),
      );
      decideDialogCloses({ confirmed: true, verdict: "approve", comment: undefined });

      await service.decide(params, run, busy);

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxDecisionNoLongerPending",
      });
    });
  });

  describe("revoke", () => {
    it("confirms, runs the mutation under the busy flag, and toasts", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);
      run.mockImplementation(async () => {
        expect(busy).toHaveBeenLastCalledWith(true);
      });

      await service.revoke(run, busy);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "pamInboxRevoke" },
        content: { key: "pamInboxRevokeConfirm" },
        acceptButtonText: { key: "pamInboxRevoke" },
        type: "warning",
      });
      expect(run).toHaveBeenCalled();
      expect(busy.mock.calls).toEqual([[true], [false]]);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxRevokedToast",
      });
    });

    it("does nothing when the confirm is dismissed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await service.revoke(run, busy);

      expect(run).not.toHaveBeenCalled();
      expect(busy).not.toHaveBeenCalled();
      expect(toastService.showToast).not.toHaveBeenCalled();
    });

    it("logs and toasts a failed revoke, and still clears the busy flag", async () => {
      const error = new Error("boom");
      dialogService.openSimpleDialog.mockResolvedValue(true);
      run.mockRejectedValue(error);

      await service.revoke(run, busy);

      expect(logService.error).toHaveBeenCalledWith(error);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxRevokeFailed",
      });
      expect(busy).toHaveBeenLastCalledWith(false);
    });
  });

  describe("withdrawApproval", () => {
    it("names the item in the confirm, then withdraws and toasts", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(true);

      await service.withdrawApproval("Prod database", run, busy);

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "pamInboxWithdrawApproval" },
        content: { key: "pamInboxWithdrawApprovalConfirm", placeholders: ["Prod database"] },
        acceptButtonText: { key: "pamInboxWithdrawApproval" },
        type: "warning",
      });
      expect(run).toHaveBeenCalled();
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        message: "pamInboxApprovalWithdrawnToast",
      });
    });

    it("does nothing when the confirm is dismissed", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      await service.withdrawApproval("Prod database", run, busy);

      expect(run).not.toHaveBeenCalled();
      expect(busy).not.toHaveBeenCalled();
    });

    it("logs and toasts a failed withdrawal", async () => {
      const error = new Error("boom");
      dialogService.openSimpleDialog.mockResolvedValue(true);
      run.mockRejectedValue(error);

      await service.withdrawApproval("Prod database", run, busy);

      expect(logService.error).toHaveBeenCalledWith(error);
      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "pamInboxWithdrawApprovalFailed",
      });
    });
  });
});

describe("rowBusy", () => {
  it("adds the row while busy and removes only that row after", () => {
    const ids = signal(new Set(["other"]));
    const flag = rowBusy(ids, "req-1");

    flag(true);
    expect([...ids()]).toEqual(["other", "req-1"]);

    flag(false);
    expect([...ids()]).toEqual(["other"]);
  });

  it("hands the signal a new set each time, so readers see the change", () => {
    const ids = signal(new Set<string>());
    const before = ids();

    rowBusy(ids, "req-1")(true);

    expect(ids()).not.toBe(before);
  });
});
