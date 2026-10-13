import { Observable, map } from "rxjs";

import { UserId } from "../../types/guid";
import { EnvironmentService, Region } from "../abstractions/environment.service";
import { GovModeService } from "../abstractions/gov-mode.service";

export class DefaultGovModeService implements GovModeService {
  readonly globalIsGovMode$: Observable<boolean>;

  constructor(private environmentService: EnvironmentService) {
    this.globalIsGovMode$ = this.environmentService.globalEnvironment$.pipe(
      map((env) => env.getRegion() === Region.Gov),
    );
  }

  isGovMode$(userId: UserId): Observable<boolean> {
    return this.environmentService
      .getEnvironment$(userId)
      .pipe(map((env) => env.getRegion() === Region.Gov));
  }
}
