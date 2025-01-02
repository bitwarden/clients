import { AuthService } from "@bitwarden/common/src/auth/abstractions/auth.service";

export abstract class ProcessReloadServiceAbstraction {
  abstract startProcessReload(authService: AuthService): Promise<void>;
  abstract cancelProcessReload(): void;
}
