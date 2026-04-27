import { Injectable, inject, signal } from "@angular/core";

import { DialogRef, DialogService } from "@bitwarden/components";

import {
  Cancel,
  DeviceApprovalChannel,
  DnaMethod,
  DuoMethod,
  Resend,
  TryAnother,
  TwoFactorMethod,
  Ui,
} from "../../importers/keeper/access";

import { KeeperAuthDialogComponent } from "./dialog/keeper-auth-dialog.component";

export type KeeperAuthStage =
  | { kind: "idle" }
  | { kind: "selectApproval"; methods: DeviceApprovalChannel[] }
  | {
      kind: "approvalCode";
      method: DeviceApprovalChannel;
      variant: "email" | "push";
    }
  | { kind: "selectTwoFactor"; methods: TwoFactorMethod[] }
  | { kind: "twoFactorCode"; method: TwoFactorMethod; needsInput: boolean }
  | { kind: "selectDuo"; methods: DuoMethod[]; phoneNumber: string }
  | { kind: "duoPush"; method: DuoMethod }
  | { kind: "selectDna"; methods: DnaMethod[] }
  | { kind: "dnaPush" }
  | { kind: "error"; message: string };

type PendingResolver = (value: unknown) => void;

@Injectable({
  providedIn: "root",
})
export class KeeperDirectImportUIService implements Ui {
  private readonly dialogService = inject(DialogService);

  private readonly _stage = signal<KeeperAuthStage>({ kind: "idle" });

  readonly stage = this._stage.asReadonly();

  private dialogRef: DialogRef | undefined;

  private setStage(next: KeeperAuthStage): void {
    this._stage.set(next);
    if (next.kind !== "idle" && this.dialogRef === undefined) {
      this.dialogRef = KeeperAuthDialogComponent.open(this.dialogService);
    }
  }

  private pendingResolver: PendingResolver | undefined;

  submit(value: unknown): void {
    this.resolvePending(value);
  }

  cancel(): void {
    this.resolvePending(Cancel);
  }

  resend(): void {
    this.resolvePending(Resend);
  }

  tryAnother(): void {
    this.resolvePending(TryAnother);
  }

  dismissError(): void {
    this.resolvePending(undefined);
  }

  reset(): void {
    this._stage.set({ kind: "idle" });
    void this.dialogRef?.close();
    this.dialogRef = undefined;
  }

  private waitForUser<T>(): Promise<T> {
    return new Promise<T>((resolve) => {
      this.pendingResolver = resolve as PendingResolver;
    });
  }

  private resolvePending(value: unknown): void {
    const resolver = this.pendingResolver;
    this.pendingResolver = undefined;
    resolver?.(value);
  }

  //
  // Device approval flow
  //

  async selectApprovalMethod(
    methods: DeviceApprovalChannel[],
  ): Promise<DeviceApprovalChannel | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.setStage({ kind: "selectApproval", methods });
    return this.waitForUser<DeviceApprovalChannel | typeof Cancel>();
  }

  async provideApprovalCode(
    method: DeviceApprovalChannel,
    _info?: string,
  ): Promise<string | typeof Cancel | typeof Resend | typeof TryAnother> {
    const variant = method === DeviceApprovalChannel.Email ? "email" : "push";

    this.setStage({ kind: "approvalCode", method, variant });
    return this.waitForUser<string | typeof Cancel | typeof Resend | typeof TryAnother>();
  }

  closeApprovalDialog(): void {
    // No-op: the next Ui call sets the next stage. Going to "idle" mid-flow causes
    // Angular to re-mount the email form, which re-fires the async validator and
    // starts parallel Vault.open calls.
  }

  //
  // 2FA flow
  //

  async selectTwoFactorMethod(
    methods: TwoFactorMethod[],
  ): Promise<TwoFactorMethod | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.setStage({ kind: "selectTwoFactor", methods });
    return this.waitForUser<TwoFactorMethod | typeof Cancel>();
  }

  async provideTwoFactorCode(
    method: TwoFactorMethod,
    _info?: string,
  ): Promise<string | typeof Cancel | typeof Resend> {
    const needsInput =
      method === TwoFactorMethod.Totp ||
      method === TwoFactorMethod.Sms ||
      method === TwoFactorMethod.Duo ||
      method === TwoFactorMethod.Backup ||
      method === TwoFactorMethod.Rsa ||
      method === TwoFactorMethod.KeeperDna;

    this.setStage({ kind: "twoFactorCode", method, needsInput });
    return this.waitForUser<string | typeof Cancel | typeof Resend>();
  }

  //
  // Duo flow
  //

  async selectDuoMethod(
    methods: DuoMethod[],
    phoneNumber: string,
  ): Promise<DuoMethod | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.setStage({ kind: "selectDuo", methods, phoneNumber });
    return this.waitForUser<DuoMethod | typeof Cancel>();
  }

  async waitForDuoPush(method: DuoMethod): Promise<typeof Cancel | void> {
    this.setStage({ kind: "duoPush", method });
    const result = await this.waitForUser<unknown>();
    if (result === Cancel) {
      return Cancel;
    }
  }

  closeDuoPushDialog(): void {
    // No-op — see closeApprovalDialog.
  }

  //
  // Keeper DNA flow
  //

  async selectDnaMethod(methods: DnaMethod[]): Promise<DnaMethod | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.setStage({ kind: "selectDna", methods });
    return this.waitForUser<DnaMethod | typeof Cancel>();
  }

  async waitForDnaPush(): Promise<typeof Cancel | void> {
    this.setStage({ kind: "dnaPush" });
    const result = await this.waitForUser<unknown>();
    if (result === Cancel) {
      return Cancel;
    }
  }

  closeDnaPushDialog(): void {
    // No-op — see closeApprovalDialog.
  }

  //
  // Error display
  //

  async showError(message: string): Promise<void> {
    this.setStage({ kind: "error", message });
    await this.waitForUser<unknown>();
  }
}
