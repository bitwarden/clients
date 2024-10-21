import { Subscription } from "rxjs";

export abstract class NotificationsService {
  abstract startListening(): Subscription;
  abstract reconnectFromActivity(): void;
  abstract disconnectFromInactivity(): void;
}
