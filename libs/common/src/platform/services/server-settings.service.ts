import { map, Observable } from "rxjs";

import { ConfigService } from "../abstractions/config/config.service";
import { ServerSettings, Settings } from "../models/domain/server-settings";

export class ServerSettingsService {
  constructor(private configService: ConfigService) {}

  getSettings$(): Observable<Settings> {
    return this.configService.serverSettings$.pipe(map((settings: ServerSettings) => settings));
  }

  get isUserRegistrationDisabled$(): Observable<boolean> {
    return this.getSettings$().pipe(map((settings: Settings) => settings.disableUserRegistration));
  }
}
