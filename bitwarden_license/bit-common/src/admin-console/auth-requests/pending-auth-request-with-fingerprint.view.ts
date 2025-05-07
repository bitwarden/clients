import { Utils } from "@bitwarden/common/platform/misc/utils";
import { KeyService } from "@bitwarden/key-management";

import { PendingAuthRequestView } from "./pending-auth-request.view";

export class PendingAuthRequestWithFingerprintView extends PendingAuthRequestView {
  fingerprintPhrase: string = "";

  static async fromView(
    view: PendingAuthRequestView,
    keyService: KeyService,
  ): Promise<PendingAuthRequestWithFingerprintView> {
    const requestWithDetailsView = Object.assign(
      new PendingAuthRequestWithFingerprintView(),
      view,
    ) as PendingAuthRequestWithFingerprintView;

    requestWithDetailsView.fingerprintPhrase = (
      await keyService.getFingerprint(
        requestWithDetailsView.email,
        Utils.fromB64ToArray(requestWithDetailsView.publicKey),
      )
    )?.join("-");

    return requestWithDetailsView;
  }
}
