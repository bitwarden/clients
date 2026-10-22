import { JsWasmStateBridge } from "@bitwarden/common/key-management/state-bridge";
import { DefaultSdkService } from "@bitwarden/common/platform/services/sdk/default-sdk.service";
import { UserId } from "@bitwarden/common/types/guid";

import { DesktopRendererStateBridge } from "../../key-management/desktop-renderer-state-bridge";

/**
 * The renderer's {@link DefaultSdkService}. It only changes the state bridge the SDK client uses:
 * the renderer reads the user key from main over IPC instead of a local copy.
 */
export class DesktopRendererSdkService extends DefaultSdkService {
  protected override createStateBridge(userId: UserId): JsWasmStateBridge {
    return new DesktopRendererStateBridge(this.stateProvider, userId);
  }
}
