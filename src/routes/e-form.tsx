import { createFileRoute } from "@tanstack/react-router";
import { IpadEFormPage } from "./ipad";

export const Route = createFileRoute("/e-form")({
  validateSearch: (search: Record<string, unknown>): { stationId?: string; areaId?: string } => {
    const res: { stationId?: string; areaId?: string } = {};
    if (typeof search["stationId"] === "string" && search["stationId"]) res.stationId = search["stationId"];
    if (typeof search["areaId"] === "string" && search["areaId"]) res.areaId = search["areaId"];
    return res;
  },
  head: () => ({
    meta: [
      { title: "PT. Krama Yudha Ratu Motor Indonesia — Line-Stop E-Form" },
      { name: "description", content: "Fast touch-optimized E-form for floor operators to record emergency line stops." },
    ],
  }),
  component: IpadEFormPage,
});

