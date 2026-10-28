import { describe, it, expect } from "vitest";
import {
  stopDurationMs,
  isBreakdown,
  mttrMs,
  mtbfMs,
  operatingTimeMs,
  avgStopMs,
  downtimeByCategory,
  computeOee,
  neutralizeExcelCell,
} from "../lib/calc";
import { shiftOf, fmtDuration } from "../lib/format";
import type { Category, LineStop, ProductionRecord, Shift } from "../lib/types";

describe("Calculation Formulas (PRD Section 2.4)", () => {
  const categories: Category[] = [
    { id: "cat-breakdown", name: "Breakdown Cat", countsAsBreakdown: true, countsAsDowntime: true, active: true, custom: false },
    { id: "cat-nonbreakdown", name: "Tool Change", countsAsBreakdown: false, countsAsDowntime: true, active: true, custom: false },
    { id: "cat-nodowntime", name: "Maintenance", countsAsBreakdown: false, countsAsDowntime: false, active: true, custom: false },
  ];

  const now = 1700000000000;

  it("calculates stopDurationMs correctly for closed and open stops", () => {
    const closedStop: LineStop = {
      id: "s1",
      areaId: "a1",
      stationId: "st1",
      startMs: now,
      endMs: now + 60_000,
      categoryId: "cat-breakdown",
      reportedBy: "Operator",
      status: "closed",
      source: "form",
    };
    expect(stopDurationMs(closedStop, now + 120_000)).toBe(60_000);

    const openStop: LineStop = {
      id: "s2",
      areaId: "a1",
      stationId: "st1",
      startMs: now,
      endMs: null,
      categoryId: "cat-breakdown",
      reportedBy: "Operator",
      status: "open",
      source: "form",
    };
    expect(stopDurationMs(openStop, now + 90_000)).toBe(90_000);
  });

  it("identifies breakdown stop correctly", () => {
    const breakdownStop: LineStop = {
      id: "s1",
      areaId: "a1",
      stationId: "st1",
      startMs: now,
      endMs: now + 30_000,
      categoryId: "cat-breakdown",
      reportedBy: "Operator",
      status: "closed",
      source: "form",
    };
    expect(isBreakdown(breakdownStop, categories)).toBe(true);

    const nonBreakdownStop: LineStop = {
      ...breakdownStop,
      categoryId: "cat-nonbreakdown",
    };
    expect(isBreakdown(nonBreakdownStop, categories)).toBe(false);
  });

  it("calculates MTTR accurately for closed breakdown stops only", () => {
    const stops: LineStop[] = [
      // 10 minutes breakdown (closed)
      {
        id: "s1",
        areaId: "a1",
        stationId: "st1",
        startMs: now,
        endMs: now + 10 * 60_000,
        categoryId: "cat-breakdown",
        reportedBy: "Operator",
        status: "closed",
        source: "form",
      },
      // 20 minutes breakdown (closed)
      {
        id: "s2",
        areaId: "a1",
        stationId: "st1",
        startMs: now + 100_000,
        endMs: now + 100_000 + 20 * 60_000,
        categoryId: "cat-breakdown",
        reportedBy: "Operator",
        status: "closed",
        source: "form",
      },
      // Open stop - should NOT count toward MTTR
      {
        id: "s3",
        areaId: "a1",
        stationId: "st1",
        startMs: now + 200_000,
        endMs: null,
        categoryId: "cat-breakdown",
        reportedBy: "Operator",
        status: "open",
        source: "form",
      },
      // Non-breakdown stop (closed) - should NOT count toward MTTR
      {
        id: "s4",
        areaId: "a1",
        stationId: "st1",
        startMs: now + 300_000,
        endMs: now + 300_000 + 15 * 60_000,
        categoryId: "cat-nonbreakdown",
        reportedBy: "Operator",
        status: "closed",
        source: "form",
      },
    ];

    // (10m + 20m) / 2 = 15m = 900,000 ms
    const mttr = mttrMs(stops, categories);
    expect(mttr).toBe(15 * 60_000);
  });

  it("calculates MTBF accurately: operatingTime / breakdown count", () => {
    const stops: LineStop[] = [
      {
        id: "s1",
        areaId: "a1",
        stationId: "st1",
        startMs: now,
        endMs: now + 10 * 60_000,
        categoryId: "cat-breakdown",
        reportedBy: "Operator",
        status: "closed",
        source: "form",
      },
      {
        id: "s2",
        areaId: "a1",
        stationId: "st1",
        startMs: now + 100_000,
        endMs: now + 100_000 + 10 * 60_000,
        categoryId: "cat-breakdown",
        reportedBy: "Operator",
        status: "closed",
        source: "form",
      },
    ];

    // 2 breakdown stops, operating time 10 hours = 36,000,000 ms
    const operatingMs = 10 * 3_600_000;
    const mtbf = mtbfMs(stops, categories, operatingMs);
    expect(mtbf).toBe(5 * 3_600_000); // 5 hours per breakdown
  });

  it("calculates operatingTimeMs deducting only stops that count as downtime", () => {
    const plannedMs = 8 * 3_600_000; // 480 min
    const stops: LineStop[] = [
      // 30 min downtime
      {
        id: "s1",
        areaId: "a1",
        stationId: "st1",
        startMs: now,
        endMs: now + 30 * 60_000,
        categoryId: "cat-breakdown",
        reportedBy: "Operator",
        status: "closed",
        source: "form",
      },
      // 15 min planned maintenance (countsAsDowntime: false) -> not deducted
      {
        id: "s2",
        areaId: "a1",
        stationId: "st1",
        startMs: now + 50_000,
        endMs: now + 50_000 + 15 * 60_000,
        categoryId: "cat-nodowntime",
        reportedBy: "Operator",
        status: "closed",
        source: "form",
      },
    ];

    const opTime = operatingTimeMs(plannedMs, stops, categories, now + 100_000);
    expect(opTime).toBe(plannedMs - 30 * 60_000);
  });

  it("calculates OEE accurately: Availability x Performance x Quality", () => {
    const record: ProductionRecord = {
      id: "p1",
      date: "2026-10-28",
      shiftId: "s1",
      areaId: "a1",
      plannedMin: 480, // 480 minutes
      totalCount: 1400,
      goodCount: 1372, // 98% quality
      idealCycleSec: 18,
    };

    // 48 minutes downtime -> Run time = 432 min -> Availability = 432 / 480 = 0.90
    const downtimeMs = 48 * 60_000;
    const result = computeOee(record, downtimeMs);

    expect(result.availability).toBeCloseTo(0.9, 2);
    // Ideal time = 1400 * 18s = 25200s. Run time = 432 * 60s = 25920s. Perf = 25200 / 25920 = 0.972
    expect(result.performance).toBeCloseTo(0.972, 2);
    // Quality = 1372 / 1400 = 0.98
    expect(result.quality).toBeCloseTo(0.98, 2);
    // OEE = 0.90 * 0.972 * 0.98 = ~0.857
    expect(result.oee).toBeCloseTo(0.857, 2);
  });

  it("neutralizes Excel Formula Injection characters (=, +, -, @)", () => {
    expect(neutralizeExcelCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(neutralizeExcelCell("+12345")).toBe("'+12345");
    expect(neutralizeExcelCell("-10+20")).toBe("'-10+20");
    expect(neutralizeExcelCell("@cmd|' /C calc'!A0")).toBe("'@cmd|' /C calc'!A0");
    expect(neutralizeExcelCell("Normal text")).toBe("Normal text");
    expect(neutralizeExcelCell("12345")).toBe("12345");
  });

  it("groups downtimeByCategory correctly and sorts descending by duration", () => {
    const stops: LineStop[] = [
      {
        id: "s1",
        areaId: "a1",
        stationId: "st1",
        startMs: now,
        endMs: now + 20 * 60_000,
        categoryId: "cat-breakdown",
        reportedBy: "Operator",
        status: "closed",
        source: "form",
      },
      {
        id: "s2",
        areaId: "a1",
        stationId: "st1",
        startMs: now + 50_000,
        endMs: now + 50_000 + 40 * 60_000,
        categoryId: "cat-nonbreakdown",
        reportedBy: "Operator",
        status: "closed",
        source: "form",
      },
    ];

    const pareto = downtimeByCategory(stops, categories, now + 100_000);
    expect(pareto.length).toBe(2);
    expect(pareto[0]!.name).toBe("Tool Change");
    expect(pareto[0]!.durationMs).toBe(40 * 60_000);
    expect(pareto[1]!.name).toBe("Breakdown Cat");
    expect(pareto[1]!.durationMs).toBe(20 * 60_000);
  });

  it("determines correct shift in WIB time zone", () => {
    const shifts: Shift[] = [
      { id: "s1", name: "Shift 1", startHour: 7, startMinute: 0 },
      { id: "s2", name: "Shift 2", startHour: 15, startMinute: 30 },
      { id: "s3", name: "Shift 3", startHour: 23, startMinute: 0 },
    ];

    // 08:30 WIB = 01:30 UTC
    const timeMorning = Date.UTC(2026, 9, 28, 1, 30);
    expect(shiftOf(timeMorning, shifts).id).toBe("s1");

    // 16:00 WIB = 09:00 UTC
    const timeAfternoon = Date.UTC(2026, 9, 28, 9, 0);
    expect(shiftOf(timeAfternoon, shifts).id).toBe("s2");

    // 23:45 WIB = 16:45 UTC
    const timeNight = Date.UTC(2026, 9, 28, 16, 45);
    expect(shiftOf(timeNight, shifts).id).toBe("s3");
  });

  it("formats durations nicely", () => {
    expect(fmtDuration(45_000)).toBe("45s");
    expect(fmtDuration(125_000)).toBe("2m 05s");
    expect(fmtDuration(3665_000)).toBe("1h 01m");
  });
});

