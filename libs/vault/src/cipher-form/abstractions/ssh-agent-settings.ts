import { Observable } from "rxjs";

/**
 * Abstraction for per-SSH-key agent settings.
 * Optionally provided on desktop to control which keys are available to the SSH agent.
 */
export abstract class SshAgentKeySettings {
  abstract isKeyEnabledForAgent$(cipherId: string): Observable<boolean>;
  abstract setKeyEnabledForAgent(cipherId: string, enabled: boolean): Promise<void>;
}
