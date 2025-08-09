export type HttpOperations = {
  createRequest: (url: string, request: RequestInit) => Request;
};
