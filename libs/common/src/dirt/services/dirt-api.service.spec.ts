import { ApiService } from "../../abstractions/api.service";

import { DirtApiService } from "./dirt-api.service";

describe("DirtApiService", () => {
  let sut: DirtApiService;
  let apiService: jest.Mocked<ApiService>;

  beforeEach(() => {
    apiService = {
      send: jest.fn(),
    } as any;

    sut = new DirtApiService(apiService);
  });

  it("should be created", () => {
    expect(sut).toBeTruthy();
  });
});
