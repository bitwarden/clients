import { Injectable } from "@angular/core";

export type ClientCertificateError =
  | "unsupported"
  | "cancelled"
  | "invalid-endpoint"
  | "invalid-file"
  | "invalid-password"
  | "unsupported-bundle"
  | "certificate-expired"
  | "certificate-not-yet-valid"
  | "identity-missing"
  | "identity-not-offered"
  | "store-password-unsupported"
  | "secret-store-unavailable"
  | "secret-store-locked"
  | "store-location-unsupported"
  | "store-corrupt"
  | "storage-failed"
  | "backend-failed"
  | "conflict";

export type ClientCertificateResult<T> =
  { ok: true; value: T } | { ok: false; error: { code: ClientCertificateError } };

export interface ClientCertificateIdentity {
  fingerprint: string;
  label: string;
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  importedAt: string;
}

export interface ClientCertificateView {
  revision: number;
  identities: Record<string, ClientCertificateIdentity>;
  bindings: Record<string, string>;
  activeBindings: Record<string, string>;
  cleanup: string[];
  restartRequired: boolean;
}

export interface ClientCertificateStatus {
  state: "ready" | "restart-pending" | "unavailable";
  error?: ClientCertificateError;
}

export type ClientCertificateChange = { revision: number; restartRequired: true };

/** Shared unsupported default; only validated desktop packages provide an adapter. */
@Injectable({ providedIn: "root" })
export class ClientCertificateSettingsService {
  supported(): boolean {
    return false;
  }
  status(): Promise<ClientCertificateResult<ClientCertificateStatus>> {
    return this.unsupported();
  }
  list(): Promise<ClientCertificateResult<ClientCertificateView>> {
    return this.unsupported();
  }
  chooseFile(): Promise<ClientCertificateResult<{ selectionId: string; fileName: string }>> {
    return this.unsupported();
  }
  inspect(
    _selectionId: string,
    _password: string,
  ): Promise<ClientCertificateResult<{ draftId: string; identity: ClientCertificateIdentity }>> {
    return this.unsupported();
  }
  commit(_request: {
    draftId: string;
    expectedRevision: number;
    endpointUrls: string[];
    replaceExisting: boolean;
  }): Promise<ClientCertificateResult<ClientCertificateChange>> {
    return this.unsupported();
  }
  bind(_request: {
    fingerprint: string;
    expectedRevision: number;
    endpointUrls: string[];
    replaceExisting: boolean;
  }): Promise<ClientCertificateResult<ClientCertificateChange>> {
    return this.unsupported();
  }
  unbind(
    _endpointUrl: string,
    _expectedRevision: number,
  ): Promise<ClientCertificateResult<ClientCertificateChange>> {
    return this.unsupported();
  }
  remove(
    _fingerprint: string,
    _expectedRevision: number,
  ): Promise<ClientCertificateResult<ClientCertificateChange>> {
    return this.unsupported();
  }
  cancelDraft(_draftId: string): Promise<ClientCertificateResult<void>> {
    return this.unsupported();
  }
  restart(): Promise<ClientCertificateResult<void>> {
    return this.unsupported();
  }

  private unsupported<T>(): Promise<ClientCertificateResult<T>> {
    return Promise.resolve({ ok: false, error: { code: "unsupported" } });
  }
}
