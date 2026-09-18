import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import {
  AutomationBiometricEvent,
  AutomationBiometricEventType,
  AutomationBiometricRequest,
  AutomationBiometricRequestType,
} from "./automation-biometric-message";
import { OsBiometricService } from "./os-biometrics.service";

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
  private eventListener?: (event: AutomationBiometricEvent) => void;

  constructor(private readonly logService: LogService) {}

  // --- Automation control surface (driven over IPC) ---

  /** Receives every queued and resolved request, so the renderer can surface them. */
  setEventListener(listener: (event: AutomationBiometricEvent) => void): void {
    this.eventListener = listener;
  }

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
    let matches: PendingRequest[];
    if (id == null) {
      matches = this.pendingRequests.splice(0, this.pendingRequests.length);
    } else {
      const index = this.pendingRequests.findIndex((r) => r.id === id);
      matches = index === -1 ? [] : this.pendingRequests.splice(index, 1);
    }
    const type = approved
      ? AutomationBiometricEventType.Approved
      : AutomationBiometricEventType.Denied;

    for (const request of matches) {
      request.resolve(approved);
      this.emit(type, request);
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
      this.emit(AutomationBiometricEventType.Requested, { id, type, userId });
    });
  }

  private emit(
    type: AutomationBiometricEventType,
    { id, type: requestType, userId }: AutomationBiometricRequest,
  ): void {
    this.eventListener?.({ type, request: { id, type: requestType, userId } });
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
