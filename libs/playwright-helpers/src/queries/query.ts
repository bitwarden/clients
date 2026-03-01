import { webServerBaseUrl } from "@playwright-config";

// First seed points at the seeder API proxy, second is the query path of the QueryController
const queryApiUrl = new URL("/seed/query", webServerBaseUrl).toString();

/**
 * A Query represents a request to the server to fetch data without modifying server state.
 * It is created by providing a Query Template name and the arguments required by the server to fulfill the query.
 *
 * Queries are intended to be executed through the {@link Play.query} method.
 *
 * Queries have a different structure to Scenes, because they do not need to track internal state to manage setup and teardown.
 */
export abstract class Query<TUp, TReturns> {
  abstract template: string;

  constructor(private upArgs: TUp) {}
  async fetch(): Promise<TReturns> {
    const result = await queryFetch<TUp, TReturns>(this.template, this.upArgs);
    return result;
  }
}

async function queryFetch<TUp, TReturns>(template: string, args: TUp): Promise<TReturns> {
  const response = await fetch(queryApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template: template,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to run query: ${response.statusText}`);
  }

  return (await response.json()) as TReturns;
}
