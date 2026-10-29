// Domain types for the Line-Stop Monitoring, Andon & OEE system.
// Timestamps are epoch milliseconds (UTC); rendering converts to plant time (WIB).

export type Role = "admin" | "manager" | "supervisor" | "operator" | "viewer";

export type Area = { id: string; name: string; note?: string | undefined };

export type Conveyor = { id: string; areaId: string; name: string };

export type Station = {
  id: string;
  code?: string | undefined;
  areaId: string;
  conveyorId: string;
  name: string;
  sequence: number;
  speedUnit: string;
  runningThreshold: number; // speeds <= this count as stopped
};

export type Category = {
  id: string;
  code?: string | undefined;
  name: string;
  countsAsBreakdown: boolean;
  countsAsDowntime: boolean;
  active: boolean;
  custom: boolean;
  createdBy?: string | undefined;
};

export type LineStop = {
  id: string;
  areaId: string;
  stationId: string;
  startMs: number;
  endMs: number | null;
  categoryId: string;
  reportedBy: string;
  status: "open" | "closed";
  source: "form" | "plc"; // form = E-form entry, plc = detected without E-form
  note?: string | undefined;
};

export type Shift = { id: string; name: string; startHour: number; startMinute: number };

export type ProductionRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  shiftId: string;
  areaId: string;
  plannedMin: number;
  totalCount: number;
  goodCount: number;
  idealCycleSec: number;
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  badge: string;
};

export type StationState = "running" | "stopped" | "nosignal";

export type StationLive = {
  stationId: string;
  state: StationState;
  speed: number;
  lastStartMs: number;
  lastStopMs: number;
  totalRunMs: number; // accumulated run time for the current shift
  stoppedSinceMs: number | null;
  lastSeenMs: number;
};

export const ROLE_ORDER: Role[] = ["admin", "manager", "supervisor", "operator", "viewer"];
