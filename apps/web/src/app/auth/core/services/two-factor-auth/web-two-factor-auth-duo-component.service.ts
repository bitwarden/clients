import { fromEvent, map, Observable, share } from "rxjs";

import { TwoFactorAuthDuoComponentService, Duo2faResult } from "@bitwarden/auth/angular";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

export class WebTwoFactorAuthDuoComponentService implements TwoFactorAuthDuoComponentService {
  private duo2faResult$: Observable<Duo2faResult>;

  constructor(private platformUtilsService: PlatformUtilsService) {
    const duoResultChannel: BroadcastChannel = new BroadcastChannel("duoResult");

    this.duo2faResult$ = fromEvent<MessageEvent>(duoResultChannel, "message").pipe(
      map((msg: MessageEvent) => {
        return {
          code: msg.data.code,
          state: msg.data.state,
          token: `${msg.data.code}|${msg.data.state}`,
        } as Duo2faResult;
      }),
      // share the observable so that multiple subscribers can listen to the same event
      share(),
    );
  }
  listenForDuo2faResult$(): Observable<Duo2faResult> {
    return this.duo2faResult$;
  }

  async launchDuoFrameless(duoFramelessUrl: string): Promise<void> {
    this.platformUtilsService.launchUri(duoFramelessUrl);
  }
}
