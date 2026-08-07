/**
 * Unit tests for the monthly attendance summary helpers.
 * Verifies the corrected algorithm:
 *   - Working days count Mon-Sat only, are clamped to a range floor/ceiling,
 *     and never extend beyond today (in-progress months don't penalize).
 *   - Weekly Off records are excluded from the effective working days.
 *   - Sanctioned Leave, Present, Late count full; Half-day counts 0.5; LOP/Absent count 0.
 *   - Legacy "Half Day" statuses fold into "Half-day".
 *
 * Run from the `backend/` folder:  node tests/attendance-summary.test.js
 */
import { accumulateStatus, countWorkingDays, finalizeMonthBucket, finalizeMonthBuckets } from "../src/controllers/attendance.controllers.js";

let failures = 0;
const check = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} -> ${JSON.stringify(actual)} (expected ${JSON.stringify(expected)})`);
    if (!ok) failures++;
};

// July 2026 is fully in the past: Jul 1 2026 is a Wednesday; Sundays are the 5th/12th/19th/26th.
// => 31 days - 4 Sundays = 27 working days.
check("countWorkingDays Jul 2026 (full past month)", countWorkingDays(2026, 6), 27);

// Joined mid-month: floor at Jul 15 -> Jul 15..31 minus Sundays 19 & 26 = 17 - 2 = 15.
check("countWorkingDays Jul 2026 floored at 2026-07-15", countWorkingDays(2026, 6, "2026-07-15", null), 15);

// Range ceiling inside the month: Jul 1..10 minus Sunday Jul 5 = 10 - 1 = 9.
check("countWorkingDays Jul 2026 capped at 2026-07-10", countWorkingDays(2026, 6, null, "2026-07-10"), 9);

// In-progress months must ignore future days: for the current real month the
// result must equal the Mon-Sat count from the 1st up to and including today.
{
    const now = new Date();
    const y = now.getUTCFullYear(), m = now.getUTCMonth();
    const todayUtc = new Date(Date.UTC(y, m, now.getUTCDate()));
    let expected = 0;
    const d = new Date(Date.UTC(y, m, 1));
    while (d <= todayUtc) { if (d.getUTCDay() !== 0) expected++; d.setUTCDate(d.getUTCDate() + 1); }
    check("countWorkingDays of current month stops at today", countWorkingDays(y, m), expected);
}

// Percentage math: 27 working days, 4 weekly offs excluded -> 23 effective.
// Attended = 5 Present + 1 Late + 1 Leave + 2 x 0.5 Half-day = 8  => 8/23 = 34.78 -> 35%
{
    const bucket = { Present: 5, Late: 1, "Half-day": 2, Leave: 1, LOP: 1, Absent: 1, "Weekly Off": 4 };
    finalizeMonthBucket(bucket, 27);
    check("finalizeMonthBucket effectiveWorkingDays", bucket.effectiveWorkingDays, 23);
    check("finalizeMonthBucket percentage", bucket.attendancePercentage, 35);
}

// Perfect month: 27 working days, 4 weekly offs + 23 present days -> 100%.
{
    const bucket = { Present: 23, Late: 0, "Half-day": 0, Leave: 0, LOP: 0, Absent: 0, "Weekly Off": 4 };
    finalizeMonthBucket(bucket, 27);
    check("finalizeMonthBucket perfect month is 100%", bucket.attendancePercentage, 100);
}

// Zero effective days (placeholder records only) must not divide by zero.
{
    const bucket = { Present: 0, Late: 0, "Half-day": 0, Leave: 0, LOP: 0, Absent: 0, "Weekly Off": 0 };
    finalizeMonthBucket(bucket, 0);
    check("finalizeMonthBucket zero working days stays 0%", bucket.attendancePercentage, 0);
    check("finalizeMonthBucket zero working days effective", bucket.effectiveWorkingDays, 0);
}

// Status bucketing: month slicing (UTC-safe string ops) + "Half Day" alias folding.
{
    const months = {};
    accumulateStatus(months, "2026-07-01", "Present");
    accumulateStatus(months, "2026-07-02", "Half Day"); // legacy alias
    accumulateStatus(months, "2026-07-03", "Half-day");
    accumulateStatus(months, "2026-07-06", "LOP");
    accumulateStatus(months, "2026-07-07", "Weekly Off");
    accumulateStatus(months, "2026-08-01", "Leave");
    accumulateStatus(months, "2026-08-02", null); // missing status falls back to Absent
    check("bucket Jul Half-day folds legacy Half Day", months["2026-07"]["Half-day"], 2);
    check("bucket Jul LOP", months["2026-07"].LOP, 1);
    check("bucket Jul Weekly Off", months["2026-07"]["Weekly Off"], 1);
    check("bucket Aug Leave", months["2026-08"].Leave, 1);
    check("bucket Aug null status -> Absent", months["2026-08"].Absent, 1);
}

// End-to-end: buckets finalized with the July floor. Attended = 1 + 0.5 = 1.5 over
// effective = 27 - 1 weekly off within Jul 15..31? Floor Jul 15 -> 15 working days,
// minus 1 weekly off record = 14 effective -> 1.5/14 = 10.71 -> 11%.
{
    const months = {};
    accumulateStatus(months, "2026-07-16", "Present");
    accumulateStatus(months, "2026-07-17", "Half-day");
    accumulateStatus(months, "2026-07-18", "Weekly Off");
    accumulateStatus(months, "2026-07-20", "LOP");
    finalizeMonthBuckets(months, "2026-07-15", null);
    check("finalizeMonthBuckets totalWorkingDays (floored)", months["2026-07"].totalWorkingDays, 15);
    check("finalizeMonthBuckets effectiveWorkingDays", months["2026-07"].effectiveWorkingDays, 14);
    check("finalizeMonthBuckets percentage", months["2026-07"].attendancePercentage, 11);
}

console.log(failures === 0 ? "\nAll summary-algorithm cases passed." : `\n${failures} case(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
