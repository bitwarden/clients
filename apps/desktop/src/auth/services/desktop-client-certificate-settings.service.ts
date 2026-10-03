import { Injectable } from "@angular/core";

import { ClientCertificateSettingsService } from "@bitwarden/angular/auth/services/client-certificate-settings.service";

/** Renderer adapter for the Flatpak-only, main-process-owned mTLS manager. */
@Injectable()
export class DesktopClientCertificateSettingsService extends ClientCertificateSettingsService {
  override supported(): boolean {
    return ipc.platform.isFlatpak;
  }
  override status() {
    return this.supported() ? ipc.platform.mtls.status() : super.status();
  }
  override list() {
    return this.supported() ? ipc.platform.mtls.list() : super.list();
  }
  override chooseFile() {
    return this.supported() ? ipc.platform.mtls.chooseFile() : super.chooseFile();
  }
  override inspect(selectionId: string, password: string) {
    return this.supported()
      ? ipc.platform.mtls.inspect(selectionId, password)
      : super.inspect(selectionId, password);
  }
  override commit(request: {
    draftId: string;
    expectedRevision: number;
    endpointUrls: string[];
    replaceExisting: boolean;
  }) {
    return this.supported() ? ipc.platform.mtls.commit(request) : super.commit(request);
  }
  override bind(request: {
    fingerprint: string;
    expectedRevision: number;
    endpointUrls: string[];
    replaceExisting: boolean;
  }) {
    return this.supported() ? ipc.platform.mtls.bind(request) : super.bind(request);
  }
  override unbind(endpointUrl: string, expectedRevision: number) {
    return this.supported()
      ? ipc.platform.mtls.unbind(endpointUrl, expectedRevision)
      : super.unbind(endpointUrl, expectedRevision);
  }
  override remove(fingerprint: string, expectedRevision: number) {
    return this.supported()
      ? ipc.platform.mtls.remove(fingerprint, expectedRevision)
      : super.remove(fingerprint, expectedRevision);
  }
  override cancelDraft(draftId: string) {
    return this.supported() ? ipc.platform.mtls.cancelDraft(draftId) : super.cancelDraft(draftId);
  }
  override restart() {
    return this.supported() ? ipc.platform.mtls.restart() : super.restart();
  }
}
