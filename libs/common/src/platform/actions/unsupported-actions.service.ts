import { ActionsService } from "./actions-service";

export class UnsupportedActionsService implements ActionsService {
  openPopup(): Promise<void> {
    throw new Error("Open Popup unsupported.");
  }
}
