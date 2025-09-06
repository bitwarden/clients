import { map } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { UserId } from "@bitwarden/common/types/guid";
import { CommercialBitwardenClient } from "@bitwarden/sdk-internal";

export class BitSdkService {
  constructor(private sdkService: SdkService) {}

  bitClient$ = this.sdkService.client$.pipe(
    map((client) => {
      return new CommercialBitwardenClient(client);
    }),
  );

  userClient$(userId: UserId) {
    return this.sdkService.userClient$(userId).pipe(
      map((rc) => {
        // TODO: Client escapes lifetime, need to tie these together somehow.
        using ref = rc.take();
        return new Rc(new CommercialBitwardenClient(ref.value));
      }),
    );
  }
}
