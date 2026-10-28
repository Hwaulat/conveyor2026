import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

describe("App routing", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches a page for / instead of falling back to not found", () => {
    const matches = router.matchRoutes("/");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches all dedicated and web routes correctly", () => {
    const routesToTest = [
      "/web",
      "/web/logs",
      "/web/production",
      "/web/reports",
      "/web/master-data",
      "/web/users",
      "/andon",
      "/ipad",
    ];

    for (const path of routesToTest) {
      const matches = router.matchRoutes(path);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    }
  });
});
