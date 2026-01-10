import { DefaultInitializeJitPasswordUserService } from "@bitwarden/angular/auth/password-management/set-initial-password/default-initialize-jit-password-user.service";
import {
  InitializeJitPasswordCredentials,
  InitializeJitPasswordUserService,
} from "@bitwarden/angular/auth/password-management/set-initial-password/initialize-jit-password-user.service.abstraction";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/user-core";

export class DesktopInitializeJitPasswordUserService implements InitializeJitPasswordUserService {
  constructor(
    private readonly initializeJitPasswordUserService: DefaultInitializeJitPasswordUserService,
    private readonly messagingService: MessagingService,
  ) {}

  async initializeUser(
    credentials: InitializeJitPasswordCredentials,
    userId: UserId,
  ): Promise<void> {
    await this.initializeJitPasswordUserService.initializeUser(credentials, userId);

    this.messagingService.send("redrawMenu");
  }
}
