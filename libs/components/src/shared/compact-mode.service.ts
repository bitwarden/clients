import { Observable } from "rxjs";

/** Global config for the Bitwarden Design System */
export abstract class CompactModeService {
  /**
   * When true, enables "compact mode".
   *
   * Component authors can also hook into compact mode with the `bit-compact:` Tailwind variant.
   **/
  abstract enabled$: Observable<boolean>;
}
