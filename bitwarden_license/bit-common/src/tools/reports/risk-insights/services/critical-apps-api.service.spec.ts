import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { CriticalAppsApiService } from "./critical-apps-api.service";

describe("CriticalAppsApiService", () => {
  let service: CriticalAppsApiService;
  const apiService = mock<ApiService>();

  beforeEach(() => {
    service = new CriticalAppsApiService(apiService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});
