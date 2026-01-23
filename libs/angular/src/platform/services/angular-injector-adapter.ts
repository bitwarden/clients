import { Injectable, Injector as NgInjector } from "@angular/core";

import { Dependency } from "@bitwarden/common/platform/abstractions/initializable";
import { Injector } from "@bitwarden/common/platform/abstractions/injector";

/**
 * Adapter that wraps Angular's Injector to implement the framework-agnostic Injector interface.
 * This enables DecentralizedInitService (from common) to work in Angular contexts
 * like the browser popup and desktop app.
 */
@Injectable()
export class AngularInjectorAdapter implements Injector {
  constructor(private readonly ngInjector: NgInjector) {}

  get<T>(token: Dependency): T {
    return this.ngInjector.get(token) as T;
  }
}
