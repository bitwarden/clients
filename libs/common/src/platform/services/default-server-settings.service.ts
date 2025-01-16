// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { ConfigService } from "../abstractions/config/config.service";
import { ServerSettings } from "../models/domain/server-settings";

export class DefaultServerSettingsService {
  constructor(private configService: ConfigService) {}

  getSettings$(): Observable<ServerSettings> {
    return this.configService.serverSettings$;
  }

  get isUserRegistrationDisabled$(): Observable<boolean> {
    return this.getSettings$().pipe(
      map((settings: ServerSettings) => settings.disableUserRegistration),
    );
  }
}
