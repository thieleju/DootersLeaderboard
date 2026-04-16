import {
  defaultShouldDehydrateQuery,
  QueryClient
} from "@tanstack/react-query";
import SuperJSON from "superjson";

import { QUERY_DEFAULT_STALE_TIME_MS } from "~/constants";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: QUERY_DEFAULT_STALE_TIME_MS
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending"
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize
      }
    }
  });
