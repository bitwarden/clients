import { Utils } from "@bitwarden/common/platform/misc/utils";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";

import { PendingAuthRequestView } from "./pending-auth-request.view";

export class PendingAuthRequestWithFingerprintView extends PendingAuthRequestView {
  fingerprintPhrase: string = "";

  static async fromView(
    view: PendingAuthRequestView,
    legacyCompatKeyService: LegacyCompatKeyService,
  ): Promise<PendingAuthRequestWithFingerprintView> {
    const requestWithDetailsView = Object.assign(
      new PendingAuthRequestWithFingerprintView(),
      view,
    ) as PendingAuthRequestWithFingerprintView;

    requestWithDetailsView.fingerprintPhrase = (
      await legacyCompatKeyService.getFingerprint(
        requestWithDetailsView.email,
        Utils.fromB64ToArray(requestWithDetailsView.publicKey),
      )
    )?.join("-");

    return requestWithDetailsView;
  }
}
