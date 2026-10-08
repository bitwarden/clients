import { Injectable } from "@angular/core";

import {
  ClientCertificateChange,
  ClientCertificateIdentity,
  ClientCertificateResult,
  ClientCertificateStatus,
  ClientCertificateView,
} from "@bitwarden/common/auth/models/client-certificate";

export type {
  ClientCertificateError,
  ClientCertificateIdentity,
  ClientCertificateView,
} from "@bitwarden/common/auth/models/client-certificate";

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
