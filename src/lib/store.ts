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

const STORAGE_KEY = "krm_conveyor_state_v4";

// Default Seed Data based on PRD & PT. Krama Yudha Ratu Motor Indonesia Factory Model
export function createSeedData(): AppState {
  const now = Date.now();
  const dayMs = 86_400_000;
  const hourMs = 3_600_000;
  const minMs = 60_000;

  const areas: Area[] = [
    { id: "area-pted", code: "PTED", name: "PTED", note: "Pre-Treatment Electro-Deposition Area" },
    { id: "area-ced", code: "CED", name: "CED", note: "Cathodic Electro-Deposition Area" },
    { id: "area-oven-ced", code: "OVEN-CED", name: "Oven CED", note: "Oven Cathodic Electro-Deposition" },
    { id: "area-mezzanine", code: "MEZZANINE", name: "Mezzanine", note: "Mezzanine Conveyor Line" },
    { id: "area-drop-ced", code: "DROP-CED", name: "Drop CED", note: "Drop Cathodic Electro-Deposition" },
    { id: "area-sanding", code: "SANDING", name: "Sanding", note: "Sanding Area" },
    { id: "area-sealing", code: "SEALING", name: "Sealing", note: "Body Sealing Line" },
    { id: "area-cooling-tunnel", code: "COOLING-TUNNEL", name: "Cooling Tunnel", note: "Cooling Tunnel Section" },
    { id: "area-topcoat", code: "TOPCOAT", name: "Topcoat", note: "Topcoat Paint Booth" },
    { id: "area-touch-up", code: "TOUCH-UP", name: "Touch Up", note: "Final Touch Up & Finish" },
  ];

  const conveyors: Conveyor[] = [
    { id: "cv-pted-1", areaId: "area-pted", name: "Conveyor PTED Main Infeed" },
    { id: "cv-pted-2", areaId: "area-pted", name: "Conveyor PTED Dip Tank" },
    { id: "cv-ced-1", areaId: "area-ced", name: "Conveyor CED Main Line" },
    { id: "cv-oven-1", areaId: "area-oven-ced", name: "Conveyor Oven CED" },
    { id: "cv-mez-1", areaId: "area-mezzanine", name: "Conveyor Mezzanine Transfer" },
    { id: "cv-drop-1", areaId: "area-drop-ced", name: "Conveyor Drop CED" },
    { id: "cv-sand-1", areaId: "area-sanding", name: "Conveyor Sanding Line" },
    { id: "cv-seal-1", areaId: "area-sealing", name: "Conveyor Sealing Line" },
    { id: "cv-cool-1", areaId: "area-cooling-tunnel", name: "Conveyor Cooling Tunnel" },
    { id: "cv-tc-1", areaId: "area-topcoat", name: "Conveyor Topcoat Booth" },
    { id: "cv-tu-1", areaId: "area-touch-up", name: "Conveyor Touch Up & Inspection" },
  ];

  const stations: Station[] = [
    { id: "st-pted-1", code: "PTED-01", areaId: "area-pted", conveyorId: "cv-pted-1", name: "Pre-Degreasing & Spray", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pted-2", code: "PTED-02", areaId: "area-pted", conveyorId: "cv-pted-1", name: "Dip Tank & Ultrasonic", sequence: 2, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pted-3", code: "PTED-03", areaId: "area-pted", conveyorId: "cv-pted-1", name: "Surface Conditioning", sequence: 3, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pted-4", code: "PTED-04", areaId: "area-pted", conveyorId: "cv-pted-2", name: "Phosphate Bath", sequence: 4, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pted-5", code: "PTED-05", areaId: "area-pted", conveyorId: "cv-pted-2", name: "DI Water Rinsing", sequence: 5, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-pted-6", code: "PTED-06", areaId: "area-pted", conveyorId: "cv-pted-2", name: "Hot Air Dryer & Transfer", sequence: 6, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-ced-1", code: "CED-01", areaId: "area-ced", conveyorId: "cv-ced-1", name: "CED Main Tank", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-oven-1", code: "OVEN-01", areaId: "area-oven-ced", conveyorId: "cv-oven-1", name: "CED Baking Zone", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-mez-1", code: "MEZ-01", areaId: "area-mezzanine", conveyorId: "cv-mez-1", name: "Mezzanine Buffer", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-drop-1", code: "DROP-01", areaId: "area-drop-ced", conveyorId: "cv-drop-1", name: "Drop CED Transfer", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-sand-1", code: "SAND-01", areaId: "area-sanding", conveyorId: "cv-sand-1", name: "Dry Sanding Booth", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-seal-1", code: "SEAL-01", areaId: "area-sealing", conveyorId: "cv-seal-1", name: "Body Sealer Robot", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-cool-1", code: "COOL-01", areaId: "area-cooling-tunnel", conveyorId: "cv-cool-1", name: "Tunnel Cooling Fan", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-tc-1", code: "TC-01", areaId: "area-topcoat", conveyorId: "cv-tc-1", name: "Topcoat Base & Clear", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
    { id: "st-tu-1", code: "TU-01", areaId: "area-touch-up", conveyorId: "cv-tu-1", name: "Finish Touch Up & QC", sequence: 1, speedUnit: "m/min", runningThreshold: 0.1 },
  ];

  const categories: Category[] = [
    {
      id: "cat-1",
      code: "CAT-PROC",
      name: "Process",
      countsAsBreakdown: false,
      countsAsDowntime: true,
      active: true,
      custom: false,
    },
    {
      id: "cat-2",
      code: "CAT-BRK",
      name: "Breakdown",
      countsAsBreakdown: true, // Used for MTTR & MTBF calculation
      countsAsDowntime: true,
      active: true,
      custom: false,
    },
    {
      id: "cat-3",
      code: "CAT-MAINT",
      name: "Maintenance",
      countsAsBreakdown: false,
      countsAsDowntime: true,
      active: true,
      custom: false,
    },
    {
      id: "cat-4",
      code: "CAT-PART",
      name: "Part Issue",
      countsAsBreakdown: false,
      countsAsDowntime: true,
      active: true,
      custom: false,
    },
  ];

  const shifts: Shift[] = [
    { id: "shift-1", name: "Shift 1 (Pagi)", startHour: 7, startMinute: 0 },
    { id: "shift-2", name: "Shift 2 (Siang)", startHour: 15, startMinute: 30 },
    { id: "shift-3", name: "Shift 3 (Malam)", startHour: 23, startMinute: 0 },
  ];

  const users: UserRow[] = [
    { id: "usr-1", name: "Budi Santoso", email: "budi.s@krm.co.id", role: "admin", badge: "EMP-001" },
    { id: "usr-2", name: "Siti Rahma", email: "siti.r@krm.co.id", role: "manager", badge: "EMP-042" },
    { id: "usr-3", name: "Agus Pratama", email: "agus.p@krm.co.id", role: "supervisor", badge: "EMP-108" },
    { id: "usr-4", name: "Rian Hidayat", email: "rian.h@krm.co.id", role: "operator", badge: "EMP-215" },
    { id: "usr-5", name: "Dewi Lestari", email: "dewi.l@krm.co.id", role: "viewer", badge: "EMP-304" },
  ];

  const devices: Device[] = [
    { id: "dev-1", name: "iPad PTED (ST-01 - ST-03)", type: "tablet", token: "tok_ipad_pted_84a1", revoked: false },
    { id: "dev-2", name: "iPad PTED (ST-04 - ST-06)", type: "tablet", token: "tok_ipad_pted_93c2", revoked: false },
    { id: "dev-3", name: "Andon Main Hall (Samsung 85\" TV)", type: "tv", token: "tok_andon_hall_44e8", revoked: false },
    { id: "dev-4", name: "Andon Supervisor Bay (LG 65\" TV)", type: "tv", token: "tok_andon_supv_12b9", revoked: false },
  ];

  // Seed stops across the last 7 days + 1 open stop right now on PTED-02
  const stops: LineStop[] = [
    // Currently open stop on PTED-02
    {
      id: "stop-live-1",
      areaId: "area-pted",
      stationId: "st-pted-2",
      startMs: now - 14 * minMs - 32 * 1000,
      endMs: null,
      categoryId: "cat-2",
      reportedBy: "Rian Hidayat",
      status: "open",
      source: "form",
      note: "Ultrasonic bath transducer sensor flagged warning",
    },
    // Completed stop earlier today on PTED-01
    {
      id: "stop-today-1",
      areaId: "area-pted",
      stationId: "st-pted-1",
      startMs: now - 2 * hourMs,
      endMs: now - 2 * hourMs + 18 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "Agus Pratama",
      status: "closed",
      source: "form",
      note: "Emergency stop pulled due to workpiece carrier misaligned",
    },
    // Unrecorded stop from PLC earlier today on PTED-04 (Source: PLC without E-form!)
    {
      id: "stop-today-plc-unrecorded",
      areaId: "area-pted",
      stationId: "st-pted-4",
      startMs: now - 3 * hourMs - 45 * minMs,
      endMs: now - 3 * hourMs - 22 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "System (PLC Detector)",
      status: "closed",
      source: "plc",
      note: "PLC zero-speed event detected without matching operator E-form entry",
    },
    // Another stop earlier today on PTED-05
    {
      id: "stop-today-2",
      areaId: "area-pted",
      stationId: "st-pted-5",
      startMs: now - 4 * hourMs,
      endMs: now - 4 * hourMs + 12 * minMs,
      categoryId: "cat-1", // Process
      reportedBy: "Dewi Lestari",
      status: "closed",
      source: "form",
      note: "Batch sample water conductivity verification",
    },
    // Yesterday stops
    {
      id: "stop-yest-1",
      areaId: "area-pted",
      stationId: "st-pted-3",
      startMs: now - dayMs - 5 * hourMs,
      endMs: now - dayMs - 5 * hourMs + 35 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "Budi Santoso",
      status: "closed",
      source: "form",
      note: "Circulation pump pressure switch thermal trip reset",
    },
    {
      id: "stop-yest-2",
      areaId: "area-pted",
      stationId: "st-pted-1",
      startMs: now - dayMs - 8 * hourMs,
      endMs: now - dayMs - 8 * hourMs + 45 * minMs,
      categoryId: "cat-3", // Maintenance
      reportedBy: "Rian Hidayat",
      status: "closed",
      source: "form",
      note: "Scheduled spray nozzle replacement and filter clean",
    },
    // 2 days ago
    {
      id: "stop-d2-1",
      areaId: "area-pted",
      stationId: "st-pted-2",
      startMs: now - 2 * dayMs - 3 * hourMs,
      endMs: now - 2 * dayMs - 3 * hourMs + 28 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "Agus Pratama",
      status: "closed",
      source: "form",
      note: "Carrier overhead chain guide roller tension adjusted",
    },
    {
      id: "stop-d2-2",
      areaId: "area-pted",
      stationId: "st-pted-4",
      startMs: now - 2 * dayMs - 6 * hourMs,
      endMs: now - 2 * dayMs - 6 * hourMs + 15 * minMs,
      categoryId: "cat-4", // Part Issue
      reportedBy: "Rian Hidayat",
      status: "closed",
      source: "form",
      note: "Waiting for chemical dosing replenishment",
    },
    // 3 days ago
    {
      id: "stop-d3-1",
      areaId: "area-pted",
      stationId: "st-pted-6",
      startMs: now - 3 * dayMs - 4 * hourMs,
      endMs: now - 3 * dayMs - 4 * hourMs + 20 * minMs,
      categoryId: "cat-3", // Maintenance
      reportedBy: "Rian Hidayat",
      status: "closed",
      source: "form",
      note: "Hot air dryer blower filter maintenance",
    },
    // 4 days ago
    {
      id: "stop-d4-1",
      areaId: "area-pted",
      stationId: "st-pted-1",
      startMs: now - 4 * dayMs - 7 * hourMs,
      endMs: now - 4 * dayMs - 7 * hourMs + 22 * minMs,
      categoryId: "cat-2", // Breakdown
      reportedBy: "Agus Pratama",
      status: "closed",
      source: "form",
      note: "Emergency rope trip tested and cleared",
    },
    // 5 days ago (another unrecorded PLC stop)
    {
      id: "stop-d5-plc",
      areaId: "area-pted",
      stationId: "st-pted-3",
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
      areaId: "area-pted",
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
      areaId: "area-pted",
      plannedMin: 450,
      totalCount: 1220 - i * 12,
      goodCount: 1195 - i * 14,
      idealCycleSec: 18,
    });
  }

  // Initial station live telemetry
  const stationLive: Record<string, StationLive> = {
    "st-pted-1": {
      stationId: "st-pted-1",
      state: "running",
      speed: 1.25,
      lastStartMs: now - 1 * hourMs - 42 * minMs,
      lastStopMs: now - 2 * hourMs,
      totalRunMs: 5 * hourMs + 14 * minMs,
      stoppedSinceMs: null,
      lastSeenMs: now,
    },
    "st-pted-2": {
      stationId: "st-pted-2",
      state: "stopped",
      speed: 0.0,
      lastStartMs: now - 2 * hourMs - 10 * minMs,
      lastStopMs: now - 14 * minMs - 32 * 1000,
      totalRunMs: 4 * hourMs + 28 * minMs,
      stoppedSinceMs: now - 14 * minMs - 32 * 1000,
      lastSeenMs: now,
    },
    "st-pted-3": {
      stationId: "st-pted-3",
      state: "running",
      speed: 1.18,
      lastStartMs: now - 3 * hourMs,
      lastStopMs: now - 5 * hourMs,
      totalRunMs: 5 * hourMs + 45 * minMs,
      stoppedSinceMs: null,
      lastSeenMs: now,
    },
    "st-pted-4": {
      stationId: "st-pted-4",
      state: "running",
      speed: 1.22,
      lastStartMs: now - 3 * hourMs - 22 * minMs,
      lastStopMs: now - 3 * hourMs - 45 * minMs,
      totalRunMs: 4 * hourMs + 52 * minMs,
      stoppedSinceMs: null,
      lastSeenMs: now,
    },
    "st-pted-5": {
      stationId: "st-pted-5",
      state: "running",
      speed: 1.20,
      lastStartMs: now - 3 * hourMs - 48 * minMs,
      lastStopMs: now - 4 * hourMs,
      totalRunMs: 5 * hourMs + 10 * minMs,
      stoppedSinceMs: null,
      lastSeenMs: now,
    },
    "st-pted-6": {
      stationId: "st-pted-6",
      state: "running",
      speed: 1.24,
      lastStartMs: now - 6 * hourMs,
      lastStopMs: now - 8 * hourMs,
      totalRunMs: 6 * hourMs + 0 * minMs,
      stoppedSinceMs: null,
      lastSeenMs: now,
    },
    "st-ced-1": {
      stationId: "st-ced-1",
      state: "running",
      speed: 1.21,
      lastStartMs: now - 4 * hourMs,
      lastStopMs: now - 6 * hourMs,
      totalRunMs: 5 * hourMs + 30 * minMs,
      stoppedSinceMs: null,
      lastSeenMs: now,
    },
    "st-oven-1": {
      stationId: "st-oven-1",
      state: "running",
      speed: 1.15,
      lastStartMs: now - 5 * hourMs,
      lastStopMs: now - 7 * hourMs,
      totalRunMs: 6 * hourMs + 10 * minMs,
      stoppedSinceMs: null,
      lastSeenMs: now,
    },
  };

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
      if (parsed.stations && parsed.stops) {
        if (Array.isArray(parsed.categories)) {
          parsed.categories = parsed.categories.map((c: any) => ({
            ...c,
            code: c.code || `CAT-${c.name.slice(0, 4).toUpperCase().replace(/\s/g, "")}`,
          }));
        }
        // Ensure standard 10 areas and PTED default data exist
        if (!parsed.areas || !parsed.areas.some((a: any) => a.name === "PTED" || a.code === "PTED")) {
          const fresh = createSeedData();
          parsed.areas = fresh.areas;
          parsed.conveyors = fresh.conveyors;
          parsed.stations = fresh.stations;
          parsed.stops = fresh.stops;
          parsed.productionRecords = fresh.productionRecords;
          parsed.stationLive = fresh.stationLive;
        }
        return parsed as AppState;
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
    const newStop: LineStop = {
      ...stop,
      id: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    currentState = {
      ...currentState,
      stops: [newStop, ...currentState.stops],
    };

    // If stop is open, update station live state to stopped
    if (newStop.status === "open") {
      const curLive = currentState.stationLive[newStop.stationId];
      if (curLive) {
        currentState.stationLive = {
          ...currentState.stationLive,
          [newStop.stationId]: {
            ...curLive,
            state: "stopped",
            speed: 0,
            lastStopMs: newStop.startMs,
            stoppedSinceMs: newStop.startMs,
          },
        };
      }
    }

    emitChange();
    return newStop;
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
    const newStop: LineStop = {
      id: `stop-sim-${Date.now()}`,
      areaId: "area-1",
      stationId,
      startMs: now,
      endMs: null,
      categoryId,
      reportedBy: source === "plc" ? "PLC Sensor Auto" : "Simulation Operator",
      status: "open",
      source,
      note: source === "plc" ? "Unrecorded stop detected by PLC tag monitor" : "Simulated line-stop emergency trigger",
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
