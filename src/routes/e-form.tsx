import { createFileRoute } from "@tanstack/react-router";
import { IpadEFormPage } from "./ipad";

export const Route = createFileRoute("/e-form")({
  validateSearch: (search: Record<string, unknown>): { stationId?: string; areaId?: string } => {
    return {
      stationId: typeof search["stationId"] === "string" ? search["stationId"] : undefined,
      areaId: typeof search["areaId"] === "string" ? search["areaId"] : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Line-Stop E-Form" },
      { name: "description", content: "Fast touch-optimized E-form for floor operators to record emergency line stops." },
    ],
  }),
  component: IpadEFormPage,
});

