import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

import { appRouter } from "~/server/api/root";
import { createLogger } from "~/server/lib/logger";
import { createTRPCContext } from "~/server/api/trpc";

const logger = createLogger("trpc");

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    headers: req.headers
  });
};

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError: ({ path, error, type }) => {
      logger.error("tRPC adapter request failed", {
        path: path ?? "<no-path>",
        procedureType: type,
        method: req.method,
        url: req.url,
        error
      });
    }
  });

export { handler as GET, handler as POST };
