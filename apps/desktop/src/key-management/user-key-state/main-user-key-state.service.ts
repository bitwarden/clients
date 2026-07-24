import { DefaultUserKeyStateService } from "@bitwarden/common/key-management/user-key-state";
import { UserKey } from "@bitwarden/common/types/key";
import { UserId } from "@bitwarden/user-core";

import { WindowMain } from "../../main/window.main";

import { UserKeyStateUpdate } from "./user-key-state-message";

/**
 * Holds the authoritative copy of the user keys in the main process, so they
 * survive renderer reloads. Every change is pushed to the renderer, which
 * mirrors it in {@link RendererUserKeyStateService}.
 */
export class MainUserKeyStateService extends DefaultUserKeyStateService {
  constructor(private readonly windowMain: WindowMain) {
    super();
  }

  override async setUserKey(userId: UserId, key: UserKey | null): Promise<void> {
    await super.setUserKey(userId, key);
    this.windowMain.win?.webContents.send("userKeyState.update", {
      userId,
      key: key?.toBase64() ?? null,
    } satisfies UserKeyStateUpdate);
  }
}
