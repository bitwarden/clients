import { ApiService } from "../../abstractions/api.service";

export class DirtApiService {
  constructor(private apiService: ApiService) {}

  // This service can be used for general DIRT-related API methods
  // For specific domains like HIBP, use dedicated services like HibpApiService
}
