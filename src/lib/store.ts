import { useEffect, useState, useSyncExternalStore } from "react";
import type { Area, Conveyor, Station, Category, LineStop, Shift, ProductionRecord, UserRow, StationLive } from "./types";
import { shiftOf } from "./format";

export type Device = {
  id: string;
  name: string;
  type: "tablet" | "tv";
  token: string;
  revoked: boolean;
};

export type AuditLogEntry = {
  id: string;
  timestampMs: number;
  user: string;
  action: string;
  details: string;
};

export interface AppState {
  areas: Area[];
  conveyors: Conveyor[];
  stations: Station[];
  categories: Category[];
  shifts: Shift[];
  users: UserRow[];
  devices: Device[];
  stops: LineStop[];
  auditLogs: AuditLogEntry[];
  productionRecords: ProductionRecord[];
  offlineQueue: LineStop[];
  stationLive: Record<string, StationLive>;
  simulating: boolean;
}

const STORAGE_KEY = "krm_conveyor_state_v14";

// Default Seed Data based on PRD & PT. Krama Yudha Ratu Motor Indonesia Factory Model
export function createSeedData(): AppState {
  const now = Date.now();
  const dayMs = 86_400_000;
  const hourMs = 3_600_000;
  const minMs = 60_000;
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(now));
  const nineAmToday = Date.parse(`${todayStr}T09:00:00+07:00`) || (now - 25 * minMs);

  const areas: Area[] = [
    { id: "area-pted", code: "PTED", name: "PTED -(Motrain Station)", note: "Motrain Pre-treatment & Electro-Deposition" },
    { id: "area-oven-ced", code: "PC-14", name: "PC-14 (Oven CED)", note: "Oven Cathodic Electro-Deposition" },
    { id: "area-mezzanine", code: "PC-15", name: "PC-15 (Mezzanine)", note: "Mezzanine Conveyor Line" },
    { id: "area-sanding", code: "PC-13", name: "PC-13 (Sanding)", note: "Sanding Area" },
    { id: "area-sealing", code: "PC-10", name: "PC-10 (Sealing)", note: "Body Sealing Line" },
    { id: "area-cooling-tunnel", code: "PC-11", name: "PC-11 (Cooling Both)", note: "Cooling Both Section" },
    { id: "area-topcoat", code: "PC-12", name: "PC-12 (Topcoat 1 Both)", note: "Topcoat Paint Booth" },
    { id: "area-topcoat-branch-a", code: "PC-12A", name: "PC-12A (Topcoat Branch A)", note: "Topcoat Branch A" },
    { id: "area-topcoat-branch-b", code: "PC-12B", name: "PC-12B (Topcoat Branch B)", note: "Topcoat Branch B" },
  ];

  const conveyors: Conveyor[] = [
    { id: "cv-pted-1", areaId: "area-pted", name: "Conveyor PTED Motrain Station" },
    { id: "cv-oven-1", areaId: "area-oven-ced", name: "Conveyor PC-14 Oven CED" },
    { id: "cv-mez-1", areaId: "area-mezzanine", name: "Conveyor PC-15 Mezzanine" },
    { id: "cv-sand-1", areaId: "area-sanding", name: "Conveyor PC-13 Sanding" },
    { id: "cv-seal-1", areaId: "area-sealing", name: "Conveyor PC-10 Sealing Line" },
    { id: "cv-cool-1", areaId: "area-cooling-tunnel", name: "Conveyor PC-11 Cooling Both" },
    { id: "cv-tc-1", areaId: "area-topcoat", name: "Conveyor PC-12 Topcoat 1 Both" },
    { id: "cv-tu-1", areaId: "area-topcoat-branch-a", name: "Conveyor PC-12A Topcoat Branch A" },
    { id: "cv-tu-2", areaId: "area-topcoat-branch-b", name: "Conveyor PC-12B Topcoat Branch B" },
  ];

  const stations: Station[] = [
    // 1. PTED Motrain (6 stations)
    { id: "st-pted-1", code: "PTED-01", areaId: "area-pted", conveyorId: "cv-pted-1", name: "Motrain Entry", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pted-2", code: "PTED-02", areaId: "area-pted", conveyorId: "cv-pted-1", name: "Flood Station", sequence: 2, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pted-3", code: "PTED-03", areaId: "area-pted", conveyorId: "cv-pted-1", name: "Pre-Degreasing", sequence: 3, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pted-4", code: "PTED-04", areaId: "area-pted", conveyorId: "cv-pted-1", name: "Degreasing", sequence: 4, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pted-5", code: "PTED-05", areaId: "area-pted", conveyorId: "cv-pted-1", name: "Phosphate", sequence: 5, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pted-6", code: "PTED-06", areaId: "area-pted", conveyorId: "cv-pted-1", name: "CED Dip", sequence: 6, speedUnit: "m/min", runningThreshold: 0.1 },

    // 2. PC-14 Oven CED (5 stations)
    { id: "st-pc14-1", code: "PC14-01", areaId: "area-oven-ced", conveyorId: "cv-oven-1", name: "Oven Entry", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pc14-2", code: "PC14-02", areaId: "area-oven-ced", conveyorId: "cv-oven-1", name: "Heat-Up Zone", sequence: 2, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pc14-3", code: "PC14-03", areaId: "area-oven-ced", conveyorId: "cv-oven-1", name: "Holding Zone", sequence: 3, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pc14-4", code: "PC14-04", areaId: "area-oven-ced", conveyorId: "cv-oven-1", name: "Cooling Zone", sequence: 4, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pc14-5", code: "PC14-05", areaId: "area-oven-ced", conveyorId: "cv-oven-1", name: "Oven Exit", sequence: 5, speedUnit: "m/min", runningThreshold: 0.1 },

    // 3. PC-15 Mezzanine (5 stations)
    { id: "st-pc15-1", code: "PC15-01", areaId: "area-mezzanine", conveyorId: "cv-mez-1", name: "Mezzanine Entry", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pc15-2", code: "PC15-02", areaId: "area-mezzanine", conveyorId: "cv-mez-1", name: "Buffer A", sequence: 2, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pc15-3", code: "PC15-03", areaId: "area-mezzanine", conveyorId: "cv-mez-1", name: "Buffer B", sequence: 3, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pc15-4", code: "PC15-04", areaId: "area-mezzanine", conveyorId: "cv-mez-1", name: "Buffer C", sequence: 4, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pc15-5", code: "PC15-05", areaId: "area-mezzanine", conveyorId: "cv-mez-1", name: "Mezzanine Discharge", sequence: 5, speedUnit: "m/min", runningThreshold: 0.1 },

    // 4. PC-13 Sanding Area (5 stations)
    { id: "st-sand-1", code: "PC13-01", areaId: "area-sanding", conveyorId: "cv-sand-1", name: "Sanding Outer", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-sand-2", code: "PC13-02", areaId: "area-sanding", conveyorId: "cv-sand-1", name: "Sanding Roof", sequence: 2, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-seal-1", code: "PC13-03", areaId: "area-sanding", conveyorId: "cv-sand-1", name: "Underseal", sequence: 3, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-seal-2", code: "PC13-04", areaId: "area-sanding", conveyorId: "cv-sand-1", name: "Undercoat", sequence: 4, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-seal-3", code: "PC13-05", areaId: "area-sanding", conveyorId: "cv-sand-1", name: "Transfer Cabin Sealing", sequence: 5, speedUnit: "m/min", runningThreshold: 0.1 },

    // 5. PC-10 Sealing Area (3 stations)
    { id: "st-seal-4", code: "PC10-01", areaId: "area-sealing", conveyorId: "cv-seal-1", name: "Roof Sealing", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-seal-5", code: "PC10-02", areaId: "area-sealing", conveyorId: "cv-seal-1", name: "Finishing Sealing", sequence: 2, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-seal-6", code: "PC10-03", areaId: "area-sealing", conveyorId: "cv-seal-1", name: "Quality Gate Sealing", sequence: 3, speedUnit: "m/min", runningThreshold: 0.1 },

    // 6. PC-11 Cooling Both (2 stations)
    { id: "st-cool-1", code: "PC11-01", areaId: "area-cooling-tunnel", conveyorId: "cv-cool-1", name: "Cooling Both", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-tc-1", code: "PC11-02", areaId: "area-cooling-tunnel", conveyorId: "cv-cool-1", name: "Transfer Cabin Touch Up", sequence: 2, speedUnit: "m/min", runningThreshold: 0.1 },

    // 7. PC-12 Topcoat 1 Both (6 stations)
    { id: "st-tc-2", code: "PC12-01", areaId: "area-topcoat", conveyorId: "cv-tc-1", name: "Airblow", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-tc-4", code: "PC12-02", areaId: "area-topcoat", conveyorId: "cv-tc-1", name: "Topcoat Station 3", sequence: 2, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-tc-3", code: "PC12-03", areaId: "area-topcoat", conveyorId: "cv-tc-1", name: "Topcoat Station 4", sequence: 3, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-tc-7", code: "PC12-04", areaId: "area-topcoat", conveyorId: "cv-tc-1", name: "ASM", sequence: 4, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-tc-6", code: "PC12-05", areaId: "area-topcoat", conveyorId: "cv-tc-1", name: "Finishing", sequence: 5, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-tc-5", code: "PC12-06", areaId: "area-topcoat", conveyorId: "cv-tc-1", name: "Setting Room", sequence: 6, speedUnit: "m/min", runningThreshold: 0.1 },

    // 8. PC-12A Topcoat Branch A (1 station)
    { id: "st-tu-1", code: "PC12A-01", areaId: "area-topcoat-branch-a", conveyorId: "cv-tu-1", name: "Panel Conveyor Touch Up", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },

    // 9. PC-12B Topcoat Branch B (1 station)
    { id: "st-tu-2", code: "PC12B-01", areaId: "area-topcoat-branch-b", conveyorId: "cv-tu-2", name: "Repair Touch Up", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
  ];

  const categories: Category[] = [
    {
      id: "cat-full-cabin",
      code: "LS-01",
      name: "Full cabin in line",
      countsAsBreakdown: false,
      countsAsDowntime: true,
      active: true,
      custom: false,
      forLinestop: true,
      forLinestopMaintenance: false,
    },
    {
      id: "cat-mtc-prob",
      code: "LS-02",
      name: "Maintenance / machine problem",
      countsAsBreakdown: true,
      countsAsDowntime: true,
      active: true,
      custom: false,
      forLinestop: true,
      forLinestopMaintenance: false,
    },
    {
      id: "cat-incident",
      code: "LS-03",
      name: "Incident",
      countsAsBreakdown: false,
      countsAsDowntime: true,
      active: true,
      custom: false,
      forLinestop: true,
      forLinestopMaintenance: false,
    },
    {
      id: "cat-2",
      code: "LS-04",
      name: "Breakdown",
      countsAsBreakdown: true, // Used for MTTR & MTBF calculation
      countsAsDowntime: true,
      active: true,
      custom: false,
      forLinestop: true,
      forLinestopMaintenance: false,
    },
    {
      id: "cat-dock-pin",
      code: "LM-01",
      name: "Dock pin stuck",
      countsAsBreakdown: true,
      countsAsDowntime: true,
      active: true,
      custom: false,
      forLinestop: false,
      forLinestopMaintenance: true,
    },
    {
      id: "cat-1",
      code: "CAT-PROC",
      name: "Process",
      countsAsBreakdown: false,
      countsAsDowntime: true,
      active: true,
      custom: false,
      forLinestop: true,
      forLinestopMaintenance: false,
    },
    {
      id: "cat-3",
      code: "CAT-MAINT",
      name: "Maintenance",
      countsAsBreakdown: false,
      countsAsDowntime: true,
      active: true,
      custom: false,
      forLinestop: true,
      forLinestopMaintenance: false,
    },
    {
      id: "cat-4",
      code: "CAT-PART",
      name: "Part Issue",
      countsAsBreakdown: false,
      countsAsDowntime: true,
      active: true,
      custom: false,
      forLinestop: true,
      forLinestopMaintenance: false,
    },
  ];

  const shifts: Shift[] = [
    { id: "shift-1", name: "Shift 1 (Pagi)", startHour: 7, startMinute: 0 },
    { id: "shift-2", name: "Shift 2 (Siang)", startHour: 15, startMinute: 30 },
    { id: "shift-3", name: "Shift 3 (Malam)", startHour: 22, startMinute: 0 },
  ];

  const users: UserRow[] = [
    { id: "usr-1", name: "Budi Santoso", email: "budi.s@krm.co.id", role: "admin", badge: "EMP-001" },
    { id: "usr-2", name: "Siti Rahma", email: "siti.r@krm.co.id", role: "manager", badge: "EMP-042" },
    { id: "usr-3", name: "Agus Pratama", email: "agus.p@krm.co.id", role: "supervisor", badge: "EMP-108" },
    { id: "usr-4", name: "Rian Hidayat", email: "rian.h@krm.co.id", role: "operator", badge: "EMP-215" },
    { id: "usr-5", name: "Dewi Lestari", email: "dewi.l@krm.co.id", role: "viewer", badge: "EMP-304" },
  ];

  const devices: Device[] = [
    { id: "dev-1", name: "iPad Sanding & Sealing", type: "tablet", token: "tok_ipad_sand_84a1", revoked: false },
    { id: "dev-2", name: "iPad Topcoat & Touch Up", type: "tablet", token: "tok_ipad_tc_93c2", revoked: false },
  ];

  // Seed stops across the last 7 days + open line-stops right now across active areas
  const stops: LineStop[] = [
    // 1. Single active open stop in Sanding Area (PC-13): Transfer Cabin Sealing (st-seal-3) - Pending E-Form
    {
      id: "stop-live-seal",
      areaId: "area-sanding",
      stationId: "st-seal-3",
      startMs: nineAmToday,
      endMs: null,
      categoryId: "", // Kosong (belum diisi form)
      reportedBy: "", // Kosong (belum diisi form)
      status: "open",
      source: "plc",
      note: "", // Kosong (belum diisi form)
      lastSpeed: 12.5,
      totalRunMs: 14_400_000,
    },
    // 2. Active open stop in Oven CED: Holding Zone (st-pc14-3) - Pending E-Form
    {
      id: "stop-live-oven",
      areaId: "area-oven-ced",
      stationId: "st-pc14-3",
      startMs: now - 35 * minMs,
      endMs: null,
      categoryId: "", // Kosong (belum diisi form)
      reportedBy: "", // Kosong (belum diisi form)
      status: "open",
      source: "plc",
      note: "", // Kosong (belum diisi form)
      lastSpeed: 0.95,
      totalRunMs: 12_800_000,
    },
    // 3. Active open stop in Mezzanine: Buffer A (st-pc15-2) - Pending E-Form
    {
      id: "stop-live-mez",
      areaId: "area-mezzanine",
      stationId: "st-pc15-2",
      startMs: now - 22 * minMs,
      endMs: null,
      categoryId: "", // Kosong (belum diisi form)
      reportedBy: "", // Kosong (belum diisi form)
      status: "open",
      source: "plc",
      note: "", // Kosong (belum diisi form)
      lastSpeed: 1.10,
      totalRunMs: 11_200_000,
    },
    // Historical completed stop earlier today on Transfer Cabin Sealing (st-seal-3) - E-form already filled
    {
      id: "stop-today-seal-early",
      areaId: "area-sanding",
      stationId: "st-seal-3",
      startMs: nineAmToday - 3 * hourMs, // 06:00 WIB
      endMs: nineAmToday - 3 * hourMs + 16 * minMs, // 06:16 WIB
      categoryId: "cat-full-cabin",
      reportedBy: "Rian Hidayat (EMP-215)",
      status: "closed",
      source: "form",
      note: "Full cabin accumulation sensor triggered, clearance verified",
      lastSpeed: 12.5,
      totalRunMs: 7_200_000,
      submittedAtMs: nineAmToday - 3 * hourMs + 18 * minMs,
    },
    // Historical completed stop yesterday on Transfer Cabin Sealing (st-seal-3) - E-form already filled
    {
      id: "stop-yest-seal-3",
      areaId: "area-sanding",
      stationId: "st-seal-3",
      startMs: now - 1 * dayMs - 4 * hourMs,
      endMs: now - 1 * dayMs - 4 * hourMs + 24 * minMs,
      categoryId: "cat-mtc-prob",
      reportedBy: "Agus Pratama (EMP-108)",
      status: "closed",
      source: "form",
      note: "Transfer carriage pneumatic cylinder seal adjustment and test run",
      lastSpeed: 12.8,
      totalRunMs: 19_800_000,
      submittedAtMs: now - 1 * dayMs - 4 * hourMs + 26 * minMs,
    },
    // Completed stop earlier today on Sanding Roof (st-sand-2) - Closed
    {
      id: "stop-today-sand",
      areaId: "area-sanding",
      stationId: "st-sand-2",
      startMs: now - 1 * hourMs - 20 * minMs,
      endMs: now - 1 * hourMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "Rian Hidayat",
      status: "closed",
      source: "form",
      note: "Sanding roller motor tension cleared",
    },
    // Completed stop earlier today on Station 4 (st-tc-3) - Closed
    {
      id: "stop-today-tc",
      areaId: "area-topcoat",
      stationId: "st-tc-3",
      startMs: now - 2 * hourMs - 15 * minMs,
      endMs: now - 2 * hourMs,
      categoryId: "cat-incident", // Incident
      reportedBy: "Dewi Lestari",
      status: "closed",
      source: "form",
      note: "Pressure drop alarm on booth applicator line normalized",
    },
    // Completed stop earlier today on Sanding Outer (st-sand-1)
    {
      id: "stop-today-1",
      areaId: "area-sanding",
      stationId: "st-sand-1",
      startMs: now - 2 * hourMs,
      endMs: now - 2 * hourMs + 18 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "Agus Pratama",
      status: "closed",
      source: "form",
      note: "Emergency stop pulled due to workpiece carrier misaligned",
    },
    // Unrecorded stop from PLC earlier today on Underseal (st-seal-1)
    {
      id: "stop-today-plc-unrecorded",
      areaId: "area-sealing",
      stationId: "st-seal-1",
      startMs: now - 3 * hourMs - 45 * minMs,
      endMs: now - 3 * hourMs - 22 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "System (PLC Detector)",
      status: "closed",
      source: "plc",
      note: "PLC zero-speed event detected without matching operator E-form entry",
    },
    // Another stop earlier today on Airblow (st-tc-2)
    {
      id: "stop-today-2",
      areaId: "area-topcoat",
      stationId: "st-tc-2",
      startMs: now - 4 * hourMs,
      endMs: now - 4 * hourMs + 12 * minMs,
      categoryId: "cat-1", // Process
      reportedBy: "Dewi Lestari",
      status: "closed",
      source: "form",
      note: "Airblow pressure calibration and nozzle check",
    },
    // Yesterday stops
    {
      id: "stop-yest-1",
      areaId: "area-touch-up",
      stationId: "st-tu-1",
      startMs: now - dayMs - 5 * hourMs,
      endMs: now - dayMs - 5 * hourMs + 35 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "Budi Santoso",
      status: "closed",
      source: "form",
      note: "Conveyor chain drive alignment adjustment",
    },
    {
      id: "stop-yest-2",
      areaId: "area-drop-ced",
      stationId: "st-drop-1",
      startMs: now - dayMs - 8 * hourMs,
      endMs: now - dayMs - 8 * hourMs + 45 * minMs,
      categoryId: "cat-3", // Maintenance
      reportedBy: "Rian Hidayat",
      status: "closed",
      source: "form",
      note: "Drop hoist limit switch inspection and clean",
    },
    // 2 days ago
    {
      id: "stop-d2-1",
      areaId: "area-sealing",
      stationId: "st-seal-3",
      startMs: now - 2 * dayMs - 3 * hourMs,
      endMs: now - 2 * dayMs - 3 * hourMs + 28 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "Agus Pratama",
      status: "closed",
      source: "form",
      note: "Transfer cabin sensor reflector cleaned",
    },
    {
      id: "stop-d2-2",
      areaId: "area-sealing",
      stationId: "st-seal-4",
      startMs: now - 2 * dayMs - 6 * hourMs,
      endMs: now - 2 * dayMs - 6 * hourMs + 15 * minMs,
      categoryId: "cat-4", // Part Issue
      reportedBy: "Rian Hidayat",
      status: "closed",
      source: "form",
      note: "Waiting for sealant drum canister replacement",
    },
    // 3 days ago
    {
      id: "stop-d3-1",
      areaId: "area-topcoat",
      stationId: "st-tc-4",
      startMs: now - 3 * dayMs - 4 * hourMs,
      endMs: now - 3 * dayMs - 4 * hourMs + 20 * minMs,
      categoryId: "cat-3", // Maintenance
      reportedBy: "Rian Hidayat",
      status: "closed",
      source: "form",
      note: "Exhaust ventilation filter replacement",
    },
    // 4 days ago
    {
      id: "stop-d4-1",
      areaId: "area-cooling-tunnel",
      stationId: "st-cool-1",
      startMs: now - 4 * dayMs - 7 * hourMs,
      endMs: now - 4 * dayMs - 7 * hourMs + 22 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "Agus Pratama",
      status: "closed",
      source: "form",
      note: "Cooling fan vibration sensor alarm cleared",
    },
    // 5 days ago (another unrecorded PLC stop)
    {
      id: "stop-d5-plc",
      areaId: "area-sanding",
      stationId: "st-sand-1",
      startMs: now - 5 * dayMs - 2 * hourMs,
      endMs: now - 5 * dayMs - 2 * hourMs + 8 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "System (PLC Detector)",
      status: "closed",
      source: "plc",
      note: "Short conveyor line stall detected automatically",
    },
  ];

  // Seed production records for the last 7 days
  const productionRecords: ProductionRecord[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now - i * dayMs);
    const dateStr = d.toISOString().slice(0, 10);
    // Shift 1
    productionRecords.push({
      id: `prod-${dateStr}-s1`,
      date: dateStr,
      shiftId: "shift-1",
      areaId: "area-sanding",
      plannedMin: 480,
      totalCount: 1350 - i * 15,
      goodCount: 1320 - i * 18,
      idealCycleSec: 18,
    });
    // Shift 2
    productionRecords.push({
      id: `prod-${dateStr}-s2`,
      date: dateStr,
      shiftId: "shift-2",
      areaId: "area-sanding",
      plannedMin: 450,
      totalCount: 1220 - i * 12,
      goodCount: 1195 - i * 14,
      idealCycleSec: 18,
    });
  }

  // Initial station live telemetry for all stations (Sealing, Oven CED, and Mezzanine stopped)
  const stationLive: Record<string, StationLive> = {};
  const stoppedConfigs: Record<string, number> = {
    "st-seal-3": now - nineAmToday, // Transfer Cabin Sealing stopped
    "st-pc14-3": 35 * minMs, // Holding Zone stopped
    "st-pc15-2": 22 * minMs, // Buffer A stopped
  };

  for (const st of stations) {
    if (stoppedConfigs[st.id] !== undefined) {
      const dur = stoppedConfigs[st.id]!;
      stationLive[st.id] = {
        stationId: st.id,
        state: "stopped",
        speed: 0.0,
        lastStartMs: now - 2 * hourMs - 10 * minMs,
        lastStopMs: now - dur,
        totalRunMs: 4 * hourMs + 28 * minMs,
        stoppedSinceMs: now - dur,
        lastSeenMs: now,
      };
    } else {
      stationLive[st.id] = {
        stationId: st.id,
        state: "running",
        speed: Number((1.15 + ((st.sequence * 3) % 15) / 100).toFixed(2)),
        lastStartMs: now - (2 + (st.sequence % 4)) * hourMs,
        lastStopMs: now - 6 * hourMs,
        totalRunMs: 5 * hourMs + 20 * minMs,
        stoppedSinceMs: null,
        lastSeenMs: now,
      };
    }
  }

  const auditLogs: AuditLogEntry[] = [
    {
      id: "log-seed-1",
      timestampMs: now - 3 * hourMs,
      user: "Super Admin",
      action: "System Initialized",
      details: "Seeded reference stations, conveyor lines and standard stop categories.",
    },
  ];

  return {
    areas,
    conveyors,
    stations,
    categories,
    shifts,
    users,
    devices,
    stops,
    auditLogs,
    productionRecords,
    offlineQueue: [],
    stationLive,
    simulating: true,
  };
}

let currentState: AppState = (() => {
  if (typeof window === "undefined") {
    return createSeedData();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const seed = createSeedData();
        const safeState: AppState = {
          ...seed,
          ...parsed,
          areas: Array.isArray(parsed.areas) && parsed.areas.length > 0 ? parsed.areas : seed.areas,
          conveyors: Array.isArray(parsed.conveyors) && parsed.conveyors.length > 0 ? parsed.conveyors : seed.conveyors,
          stations: Array.isArray(parsed.stations) && parsed.stations.length > 0 ? parsed.stations : seed.stations,
          categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : seed.categories,
          shifts: Array.isArray(parsed.shifts) && parsed.shifts.length > 0 ? parsed.shifts : seed.shifts,
          users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : seed.users,
          devices: Array.isArray(parsed.devices) && parsed.devices.length > 0 ? parsed.devices : seed.devices,
          stops: Array.isArray(parsed.stops) ? parsed.stops : seed.stops,
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : seed.auditLogs,
          productionRecords: Array.isArray(parsed.productionRecords) ? parsed.productionRecords : seed.productionRecords,
          offlineQueue: Array.isArray(parsed.offlineQueue) ? parsed.offlineQueue : [],
          stationLive: parsed.stationLive && typeof parsed.stationLive === "object" ? { ...seed.stationLive, ...parsed.stationLive } : seed.stationLive,
        };

        safeState.categories = safeState.categories.map((c: any) => ({
          ...c,
          code: c.code || `CAT-${c.name?.slice(0, 4).toUpperCase().replace(/\s/g, "") || "GEN"}`,
        }));

        if (
          !safeState.areas.some((a) => a.id === "area-pted" || a.code === "PTED") ||
          !safeState.stations.some((s) => s.id === "st-pted-1") ||
          !safeState.stations.some((s) => s.id === "st-pc14-1") ||
          !safeState.stations.some((s) => s.id === "st-pc15-1")
        ) {
          safeState.areas = seed.areas;
          safeState.conveyors = seed.conveyors;
          safeState.stations = seed.stations;
          safeState.stops = seed.stops;
          safeState.productionRecords = seed.productionRecords;
          safeState.stationLive = seed.stationLive;
        }

        // Ensure newly defined stations exist in safeState
        for (const s of seed.stations) {
          if (!safeState.stations.some((x) => x.id === s.id)) {
            safeState.stations.push(s);
            if (!safeState.stationLive[s.id]) {
              safeState.stationLive[s.id] = seed.stationLive[s.id]!;
            }
          }
        }

        const hasStoppedStation = Object.values(safeState.stationLive || {}).some((s) => s?.state === "stopped");
        const hasPC14Stopped = safeState.stationLive["st-pc14-3"]?.state === "stopped";
        const hasMezStopped = safeState.stationLive["st-pc15-2"]?.state === "stopped";
        if (!hasStoppedStation || !hasPC14Stopped || !hasMezStopped) {
          safeState.stationLive = seed.stationLive;
          safeState.stops = seed.stops;
        }

        return safeState;
      }
    }
  } catch (e) {
    console.warn("Failed to load stored PT. Krama Yudha Ratu Motor Indonesia state, using seed data", e);
  }
  const initial = createSeedData();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  } catch {
    // ignore
  }
  return initial;
})();

const listeners = new Set<() => void>();

function emitChange() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch {
      // quota or private browsing
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

export const store = {
  getSnapshot: (): AppState => currentState,

  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  update: (fn: (prev: AppState) => AppState) => {
    currentState = fn(currentState);
    emitChange();
  },

  resetToSeed: () => {
    currentState = createSeedData();
    emitChange();
  },

  // Stop Actions
  addStop: (stop: Omit<LineStop, "id">): LineStop => {
    // If there is already an open stop for this station (e.g. from PLC sensor or pending e-form),
    // update it with the submitted E-form details while preserving the original stop start timestamp!
    const existingOpenIndex = currentState.stops.findIndex(
      (s) => s.stationId === stop.stationId && s.status === "open"
    );

    let resultingStop: LineStop;
    if (existingOpenIndex >= 0) {
      const existing = currentState.stops[existingOpenIndex]!;
      resultingStop = {
        ...existing,
        ...stop,
        id: existing.id,
        startMs: existing.startMs, // keep initial line stop start time
        source: "form",
        submittedAtMs: Date.now(),
        lastSpeed: existing.lastSpeed ?? currentState.stationLive[stop.stationId]?.speed ?? 12.5,
        totalRunMs: existing.totalRunMs ?? currentState.stationLive[stop.stationId]?.totalRunMs ?? 14_400_000,
      };
      const updatedStops = [...currentState.stops];
      updatedStops[existingOpenIndex] = resultingStop;
      currentState = {
        ...currentState,
        stops: updatedStops,
      };
    } else {
      resultingStop = {
        ...stop,
        id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        submittedAtMs: stop.source === "form" ? Date.now() : undefined,
        lastSpeed: stop.lastSpeed ?? currentState.stationLive[stop.stationId]?.speed ?? 12.5,
        totalRunMs: stop.totalRunMs ?? currentState.stationLive[stop.stationId]?.totalRunMs ?? 14_400_000,
      };
      currentState = {
        ...currentState,
        stops: [resultingStop, ...currentState.stops],
      };
    }

    // If stop is open, update station live state to stopped
    if (resultingStop.status === "open") {
      const curLive = currentState.stationLive[resultingStop.stationId];
      if (curLive) {
        currentState.stationLive = {
          ...currentState.stationLive,
          [resultingStop.stationId]: {
            ...curLive,
            state: "stopped",
            speed: 0,
            lastStopMs: resultingStop.startMs,
            stoppedSinceMs: resultingStop.startMs,
          },
        };
      }
    }

    emitChange();
    return resultingStop;
  },

  closeStop: (stopId: string, endMs: number = Date.now()) => {
    let closedStationId: string | null = null;
    const updatedStops = currentState.stops.map((s) => {
      if (s.id === stopId) {
        closedStationId = s.stationId;
        return {
          ...s,
          status: "closed" as const,
          endMs: Math.max(s.startMs, endMs),
        };
      }
      return s;
    });

    let updatedLive = currentState.stationLive;
    if (closedStationId) {
      const station = closedStationId;
      // Check if station has other open stops
      const hasOtherOpen = updatedStops.some((s) => s.stationId === station && s.status === "open");
      if (!hasOtherOpen && updatedLive[station]) {
        const cur = updatedLive[station]!;
        updatedLive = {
          ...updatedLive,
          [station]: {
            ...cur,
            state: "running",
            speed: 1.2 + (Math.random() * 0.1 - 0.05),
            lastStartMs: endMs,
            stoppedSinceMs: null,
          },
        };
      }
    }

    currentState = {
      ...currentState,
      stops: updatedStops,
      stationLive: updatedLive,
    };
    emitChange();
  },

  correctStop: (
    stopId: string,
    updates: Partial<Pick<LineStop, "categoryId" | "startMs" | "endMs" | "reportedBy" | "note" | "source">>,
    reason: string,
    operator: string = "Super Admin"
  ) => {
    const existing = currentState.stops.find((s) => s.id === stopId);
    if (!existing) return;

    const newStop: LineStop = {
      ...existing,
      ...updates,
    };

    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestampMs: Date.now(),
      user: operator,
      action: `Corrected Stop #${stopId}`,
      details: `Reason: ${reason}. Original: [Cat: ${existing.categoryId}, Start: ${existing.startMs}, End: ${existing.endMs}]. Updated: [Cat: ${newStop.categoryId}, Start: ${newStop.startMs}, End: ${newStop.endMs}]`,
    };

    currentState = {
      ...currentState,
      stops: currentState.stops.map((s) => (s.id === stopId ? newStop : s)),
      auditLogs: [auditEntry, ...currentState.auditLogs],
    };
    emitChange();
  },

  voidStop: (stopId: string, reason: string, operator: string = "Super Admin") => {
    const existing = currentState.stops.find((s) => s.id === stopId);
    if (!existing) return;

    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestampMs: Date.now(),
      user: operator,
      action: `Voided Stop #${stopId}`,
      details: `Reason: ${reason}. Station: ${existing.stationId}, Start: ${existing.startMs}`,
    };

    currentState = {
      ...currentState,
      stops: currentState.stops.filter((s) => s.id !== stopId),
      auditLogs: [auditEntry, ...currentState.auditLogs],
    };
    emitChange();
  },

  // Category Actions
  addCategory: (cat: Omit<Category, "id"> & { id?: string }): Category => {
    const newCat: Category = {
      ...cat,
      id: cat.id || `cat-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    currentState = {
      ...currentState,
      categories: [...currentState.categories, newCat],
    };
    emitChange();
    return newCat;
  },

  updateCategory: (id: string, updates: Partial<Category>) => {
    currentState = {
      ...currentState,
      categories: currentState.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    };
    emitChange();
  },

  deleteCategory: (id: string) => {
    currentState = {
      ...currentState,
      categories: currentState.categories.filter((c) => c.id !== id),
    };
    emitChange();
  },

  mergeCategories: (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const stopsMoved = currentState.stops.filter((s) => s.categoryId === fromId).length;
    currentState = {
      ...currentState,
      stops: currentState.stops.map((s) => (s.categoryId === fromId ? { ...s, categoryId: toId } : s)),
      categories: currentState.categories.filter((c) => c.id !== fromId),
      auditLogs: [
        {
          id: `audit-${Date.now()}`,
          timestampMs: Date.now(),
          user: "Super Admin",
          action: "Merged Categories",
          details: `Merged category ${fromId} into ${toId}. ${stopsMoved} stops updated.`,
        },
        ...currentState.auditLogs,
      ],
    };
    emitChange();
  },

  // Area & Conveyor Helpers
  ensureArea: (name: string): Area => {
    const trimmed = name.trim();
    const existing = currentState.areas.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const newArea: Area = {
      id: `area-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: trimmed,
    };
    currentState = {
      ...currentState,
      areas: [...currentState.areas, newArea],
    };
    emitChange();
    return newArea;
  },

  ensureConveyor: (name: string, areaId: string): Conveyor => {
    const trimmed = name.trim();
    const existing = currentState.conveyors.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.areaId === areaId,
    );
    if (existing) return existing;
    const newConveyor: Conveyor = {
      id: `cv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      areaId,
      name: trimmed,
    };
    currentState = {
      ...currentState,
      conveyors: [...currentState.conveyors, newConveyor],
    };
    emitChange();
    return newConveyor;
  },

  updateConveyor: (conveyorId: string, updates: Partial<Conveyor>) => {
    currentState = {
      ...currentState,
      conveyors: currentState.conveyors.map((c) => (c.id === conveyorId ? { ...c, ...updates } : c)),
    };
    emitChange();
  },

  toggleConveyorActive: (conveyorId: string): boolean => {
    const conv = currentState.conveyors.find((c) => c.id === conveyorId);
    const nextActive = conv ? conv.active === false : false;
    currentState = {
      ...currentState,
      conveyors: currentState.conveyors.map((c) => (c.id === conveyorId ? { ...c, active: nextActive } : c)),
      stations: currentState.stations.map((s) => (s.conveyorId === conveyorId ? { ...s, active: nextActive } : s)),
    };
    emitChange();
    return nextActive;
  },

  deleteConveyor: (conveyorId: string) => {
    const stationsToDelete = currentState.stations.filter((s) => s.conveyorId === conveyorId);
    const deletedStationIds = new Set(stationsToDelete.map((s) => s.id));
    const nextLive = { ...currentState.stationLive };
    for (const sid of deletedStationIds) {
      delete nextLive[sid];
    }
    currentState = {
      ...currentState,
      conveyors: currentState.conveyors.filter((c) => c.id !== conveyorId),
      stations: currentState.stations.filter((s) => s.conveyorId !== conveyorId),
      stationLive: nextLive,
    };
    emitChange();
  },

  syncConveyorStations: (
    conveyorId: string,
    areaId: string,
    drafts: Array<{ id?: string; code: string; name: string }>
  ) => {
    const now = Date.now();
    const existingStationMap = new Map(currentState.stations.map((s) => [s.id, s]));
    const newLive = { ...currentState.stationLive };
    const resultingStations: Station[] = [];

    // Filter out stations for this conveyor from current stations
    const otherStations = currentState.stations.filter((s) => s.conveyorId !== conveyorId);

    drafts.forEach((d, idx) => {
      const code = d.code.trim().toUpperCase() || `ST-${String(idx + 1).padStart(2, "0")}`;
      const name = d.name.trim();
      if (!name) return;

      if (d.id && existingStationMap.has(d.id)) {
        const existing = existingStationMap.get(d.id)!;
        resultingStations.push({
          ...existing,
          code,
          name,
          areaId,
          conveyorId,
          sequence: idx + 1,
        });
      } else {
        const newId = `st-${now + idx}-${Math.floor(Math.random() * 1000)}`;
        resultingStations.push({
          id: newId,
          code,
          name,
          areaId,
          conveyorId,
          sequence: idx + 1,
          speedUnit: "m/min",
          runningThreshold: 0.1,
          active: true,
        });
        newLive[newId] = {
          stationId: newId,
          state: "running",
          speed: 1.2,
          lastStartMs: now,
          lastStopMs: now - 3600000,
          totalRunMs: 0,
          stoppedSinceMs: null,
          lastSeenMs: now,
        };
      }
    });

    currentState = {
      ...currentState,
      stations: [...otherStations, ...resultingStations],
      stationLive: newLive,
    };
    emitChange();
  },

  // Station Actions
  addStation: (st: Omit<Station, "id"> & { id?: string }): Station => {
    const newStation: Station = {
      ...st,
      id: st.id || `st-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    currentState = {
      ...currentState,
      stations: [...currentState.stations, newStation],
      stationLive: {
        ...currentState.stationLive,
        [newStation.id]: {
          stationId: newStation.id,
          state: "running",
          speed: 1.2,
          lastStartMs: Date.now(),
          lastStopMs: Date.now() - 3600000,
          totalRunMs: 0,
          stoppedSinceMs: null,
          lastSeenMs: Date.now(),
        },
      },
    };
    emitChange();
    return newStation;
  },

  addStationsBatch: (stationsToAdd: Array<Omit<Station, "id"> & { id?: string }>): Station[] => {
    const created: Station[] = [];
    const newLiveMap = { ...currentState.stationLive };
    const now = Date.now();

    for (const [i, item] of stationsToAdd.entries()) {
      const id = item.id || `st-${now + i}-${Math.floor(Math.random() * 1000)}`;
      const newStation: Station = {
        ...item,
        id,
      };
      created.push(newStation);
      newLiveMap[newStation.id] = {
        stationId: newStation.id,
        state: "running",
        speed: 1.2,
        lastStartMs: now,
        lastStopMs: now - 3600000,
        totalRunMs: 0,
        stoppedSinceMs: null,
        lastSeenMs: now,
      };
    }

    currentState = {
      ...currentState,
      stations: [...currentState.stations, ...created],
      stationLive: newLiveMap,
    };
    emitChange();
    return created;
  },

  deleteStation: (id: string) => {
    const nextStations = currentState.stations.filter((s) => s.id !== id);
    const nextLive = { ...currentState.stationLive };
    delete nextLive[id];
    currentState = {
      ...currentState,
      stations: nextStations,
      stationLive: nextLive,
    };
    emitChange();
  },

  updateStation: (id: string, updates: Partial<Station>) => {
    currentState = {
      ...currentState,
      stations: currentState.stations.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    };
    emitChange();
  },

  // User Actions
  updateUserRole: (userId: string, role: UserRow["role"]) => {
    const user = currentState.users.find((u) => u.id === userId);
    if (!user) return;
    const oldRole = user.role;
    currentState = {
      ...currentState,
      users: currentState.users.map((u) => (u.id === userId ? { ...u, role } : u)),
      auditLogs: [
        {
          id: `audit-${Date.now()}`,
          timestampMs: Date.now(),
          user: "Super Admin",
          action: `Role Changed for ${user.name}`,
          details: `Role changed from ${oldRole} to ${role}`,
        },
        ...currentState.auditLogs,
      ],
    };
    emitChange();
  },

  addUser: (user: Omit<UserRow, "id">) => {
    const newUser: UserRow = {
      ...user,
      id: `usr-${Date.now()}`,
    };
    currentState = {
      ...currentState,
      users: [...currentState.users, newUser],
    };
    emitChange();
  },

  // Device Actions
  addDevice: (device: Omit<Device, "id" | "token" | "revoked">) => {
    const newDev: Device = {
      ...device,
      id: `dev-${Date.now()}`,
      token: `tok_${device.type}_${Math.random().toString(36).slice(2, 8)}`,
      revoked: false,
    };
    currentState = {
      ...currentState,
      devices: [...currentState.devices, newDev],
    };
    emitChange();
  },

  revokeDeviceToken: (deviceId: string) => {
    currentState = {
      ...currentState,
      devices: currentState.devices.map((d) => (d.id === deviceId ? { ...d, revoked: true } : d)),
    };
    emitChange();
  },

  // Production Records (OEE)
  commitProductionRecords: (records: Omit<ProductionRecord, "id">[]) => {
    // If date + shift + area already exists, update it, else add
    const current = [...currentState.productionRecords];
    for (const r of records) {
      const idx = current.findIndex(
        (existing) => existing.date === r.date && existing.shiftId === r.shiftId && existing.areaId === r.areaId
      );
      if (idx >= 0) {
        current[idx] = { ...r, id: current[idx]!.id };
      } else {
        current.push({ ...r, id: `prod-${r.date}-${r.shiftId}-${Math.random().toString(36).slice(2, 5)}` });
      }
    }
    currentState = {
      ...currentState,
      productionRecords: current,
    };
    emitChange();
  },

  // Offline Queue for iPad
  queueOfflineStop: (stop: Omit<LineStop, "id">) => {
    const item: LineStop = {
      ...stop,
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    currentState = {
      ...currentState,
      offlineQueue: [...currentState.offlineQueue, item],
    };
    emitChange();
    return item;
  },

  syncOfflineQueue: (): number => {
    const count = currentState.offlineQueue.length;
    if (count === 0) return 0;
    const synced = currentState.offlineQueue.map((s) => ({
      ...s,
      id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }));
    currentState = {
      ...currentState,
      stops: [...synced, ...currentState.stops],
      offlineQueue: [],
    };
    emitChange();
    return count;
  },

  // Simulation Toggle & Manual Trigger
  toggleSimulation: () => {
    currentState = {
      ...currentState,
      simulating: !currentState.simulating,
    };
    emitChange();
  },

  simulateStopTrigger: (stationId: string, categoryId: string = "cat-2", source: "form" | "plc" = "form") => {
    const now = Date.now();
    const targetStation = currentState.stations.find((s) => s.id === stationId);
    const newStop: LineStop = {
      id: `stop-sim-${Date.now()}`,
      areaId: targetStation?.areaId || "area-sanding",
      stationId,
      startMs: now,
      endMs: null,
      categoryId: source === "plc" ? "" : categoryId,
      reportedBy: source === "plc" ? "" : "Simulation Operator",
      status: "open",
      source,
      note: source === "plc" ? "" : "Simulated line-stop emergency trigger",
    };
    const curLive = currentState.stationLive[stationId];
    currentState = {
      ...currentState,
      stops: [newStop, ...currentState.stops],
      stationLive: {
        ...currentState.stationLive,
        [stationId]: {
          stationId,
          state: "stopped",
          speed: 0,
          lastStartMs: curLive?.lastStartMs ?? now - 3600000,
          lastStopMs: now,
          totalRunMs: curLive?.totalRunMs ?? 14400000,
          stoppedSinceMs: now,
          lastSeenMs: now,
        },
      },
    };
    emitChange();
  },

  simulateResumeStation: (stationId: string) => {
    const now = Date.now();
    const openStop = currentState.stops.find((s) => s.stationId === stationId && s.status === "open");
    let stops = currentState.stops;
    if (openStop) {
      stops = stops.map((s) => (s.id === openStop.id ? { ...s, status: "closed" as const, endMs: now } : s));
    }
    const curLive = currentState.stationLive[stationId];
    currentState = {
      ...currentState,
      stops,
      stationLive: {
        ...currentState.stationLive,
        [stationId]: {
          stationId,
          state: "running",
          speed: 1.2 + (Math.random() * 0.1 - 0.05),
          lastStartMs: now,
          lastStopMs: curLive?.lastStopMs ?? now - 60000,
          totalRunMs: (curLive?.totalRunMs ?? 14400000) + 1000,
          stoppedSinceMs: null,
          lastSeenMs: now,
        },
      },
    };
    emitChange();
  },
};

// React Hook
export function useAppStore(): AppState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

// Background simulation ticker (only runs in browser)
if (typeof window !== "undefined") {
  // Sync across tabs via storage event
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        currentState = JSON.parse(e.newValue);
        for (const listener of listeners) listener();
      } catch {
        // ignore
      }
    }
  });

  // Telemetry jitter and timer advancement loop
  setInterval(() => {
    if (!currentState.simulating) return;
    const now = Date.now();
    let changed = false;
    const nextLive: Record<string, StationLive> = { ...currentState.stationLive };

    for (const [sId, live] of Object.entries(nextLive)) {
      if (live.state === "running") {
        // slight speed fluctuation
        const jitter = (Math.random() - 0.5) * 0.04;
        const newSpeed = Math.max(0.9, Math.min(1.5, Number((live.speed + jitter).toFixed(2))));
        nextLive[sId] = {
          ...live,
          speed: newSpeed,
          totalRunMs: live.totalRunMs + 3000,
          lastSeenMs: now,
        };
        changed = true;
      } else if (live.state === "stopped") {
        // station is stopped, keep speed at 0
        if (live.speed !== 0) {
          nextLive[sId] = { ...live, speed: 0, lastSeenMs: now };
          changed = true;
        }
      }
    }

    if (changed) {
      currentState = {
        ...currentState,
        stationLive: nextLive,
      };
      // notify listeners without spamming localStorage every 3s
      for (const listener of listeners) listener();
    }
  }, 3000);
}
