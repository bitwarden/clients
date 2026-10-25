import { Injectable, OnDestroy } from "@angular/core";

import { DefaultImportStagingService } from "../services";

/** Clears the staged items when the providing shell is destroyed. */
@Injectable()
export class ImportShellStagingService extends DefaultImportStagingService implements OnDestroy {
  ngOnDestroy(): void {
    this.clear();
  }
}
