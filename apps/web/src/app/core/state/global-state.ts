import { GlobalState as BaseGlobalState } from "@bitwarden/common/platform/models/domain/global-state";

export class GlobalState extends BaseGlobalState {
  rememberEmail = true;
}
