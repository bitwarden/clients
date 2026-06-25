import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";

import { OsBiometricService } from "./os-biometrics.service";

export type AutomationBiometricRequestType = "authenticate" | "unlock";

export interface AutomationBiometricRequest {
  id: string;
  type: AutomationBiometricRequestType;
  userId?: UserId;
}

interface PendingRequest extends AutomationBiometricRequest {
  resolve: (approved: boolean) => void;
}

/**
 * A fake {@link OsBiometricService} used for automation (E2E tests, manual automation). It replaces
 * the real OS biometric service on the desktop main process when running in dev mode with the
 * `USE_AUTOMATION_BIOMETRICS` environment variable set, so the native OS prompt never fires.
 *
 * Biometric requests are queued and block until automation approves or denies them, allowing tests
 * to deterministically simulate the user accepting or rejecting the native prompt. The reported
 * biometric status is settable. Biometric keys are held in memory only (no OS keychain), so they do
 * not persist across restarts.
 */
export class AutomationBiometricsService implements OsBiometricService {
  private mockStatus = BiometricsStatus.Available;
  private keys = new Map<UserId, SymmetricCryptoKey>();
  private pendingRequests: PendingRequest[] = [];
  private nextRequestId = 1;

  constructor(private logService: LogService) {}

  // --- Automation control surface (driven over IPC) ---

  setMockStatus(status: BiometricsStatus): void {
    this.mockStatus = status;
  }

  listPendingRequests(): AutomationBiometricRequest[] {
    return this.pendingRequests.map(({ id, type, userId }) => ({ id, type, userId }));
  }

  approveRequest(id?: string): void {
    this.resolveRequests(id, true);
  }

  denyRequest(id?: string): void {
    this.resolveRequests(id, false);
  }

  private resolveRequests(id: string | undefined, approved: boolean): void {
    const matches =
      id == null
        ? this.pendingRequests.splice(0, this.pendingRequests.length)
        : this.pendingRequests
            .filter((r) => r.id === id)
            .map((r) => {
              this.pendingRequests.splice(this.pendingRequests.indexOf(r), 1);
              return r;
            });
    for (const request of matches) {
      request.resolve(approved);
    }
  }

  private awaitApproval(type: AutomationBiometricRequestType, userId?: UserId): Promise<boolean> {
    const id = (this.nextRequestId++).toString();
    this.logService.info(
      "[AutomationBiometrics] Pending %s request %s awaiting approval",
      type,
      id,
    );
    return new Promise<boolean>((resolve) => {
      this.pendingRequests.push({ id, type, userId, resolve });
    });
  }

  // --- OsBiometricService implementation ---

  async supportsBiometrics(): Promise<boolean> {
    return this.mockStatus !== BiometricsStatus.HardwareUnavailable;
  }

  async needsSetup(): Promise<boolean> {
    return false;
  }

  async canAutoSetup(): Promise<boolean> {
    return false;
  }

  async runSetup(): Promise<void> {
    return;
  }

  async authenticateBiometric(): Promise<boolean> {
    return await this.awaitApproval("authenticate");
  }

  async getBiometricKey(userId: UserId): Promise<SymmetricCryptoKey | null> {
    const approved = await this.awaitApproval("unlock", userId);
    if (!approved) {
      return null;
    }
    return this.keys.get(userId) ?? null;
  }

  async setBiometricKey(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    this.keys.set(userId, key);
  }

  async deleteBiometricKey(userId: UserId): Promise<void> {
    this.keys.delete(userId);
  }

  async getBiometricsFirstUnlockStatusForUser(userId: UserId): Promise<BiometricsStatus> {
    if (this.mockStatus !== BiometricsStatus.Available) {
      return this.mockStatus;
    }
    return this.keys.has(userId) ? BiometricsStatus.Available : BiometricsStatus.UnlockNeeded;
  }

  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    this.keys.set(userId, key);
  }

  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return this.keys.has(userId);
  }
}
