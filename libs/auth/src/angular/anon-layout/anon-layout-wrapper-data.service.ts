import { Observable } from "rxjs";

import { AnonLayoutWrapperData } from "./anon-layout-wrapper.component";

/**
 * A simple data service to allow any child components of the AnonLayoutWrapperComponent to override
 * page route data and dynamically control the data fed into the AnonLayoutComponent via the AnonLayoutWrapperComponent.
 */
export abstract class AnonLayoutWrapperDataService {
  /**
   *
   * @param data - The data to set on the AnonLayoutWrapperComponent to feed into the AnonLayoutComponent.
   */
  abstract setAnonLayoutWrapperData(data: AnonLayoutWrapperData): void;

  /**
   * Reactively gets the current AnonLayoutWrapperData.
   */
  abstract anonLayoutWrapperData$(): Observable<AnonLayoutWrapperData>;
}
