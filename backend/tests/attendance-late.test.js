// Verifies the 10:15 AM late-punch cutoff used by the check-in controller.
// Run: node tests/attendance-late.test.js
// Results must be identical regardless of the host machine's timezone
// (try: TZ=UTC, TZ=America/New_York, TZ=Asia/Kolkata).
import { getISTClockParts } from "../src/controllers/attendance.controllers.js";

// Mirrors the exact predicate in attendance.controllers.js checkIn
const isLate = (date) => {
    const { hours, minutes } = getISTClockParts(date);
    return hours > 10 || (hours === 10 && minutes > 15);
};

// Cases are fixed UTC instants; labels show what the office clock in IST reads.
const cases = [
    ["2026-08-07T03:59:00.000Z", false, "9:29 AM IST (well before cutoff)"],
    ["2026-08-07T04:44:59.000Z", false, "10:14:59 AM IST (just before cutoff)"],
    ["2026-08-07T04:45:00.000Z", false, "exactly 10:15:00 AM IST (still Present)"],
    ["2026-08-07T04:45:59.000Z", false, "10:15:59 AM IST (same displayed minute)"],
    ["2026-08-07T04:46:00.000Z", true, "10:16:00 AM IST (first Late minute)"],
    ["2026-08-07T05:30:00.000Z", true, "11:00 AM IST"],
    ["2026-08-07T12:30:00.000Z", true, "6:00 PM IST (evening punch)"],
];

let failed = 0;
console.log(`Host timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone} (must not affect results)`);
for (const [iso, expected, label] of cases) {
    const got = isLate(new Date(iso));
    const ok = got === expected;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label} -> isLate=${got} (expected ${expected})`);
}

if (failed) {
    console.error(`\n${failed} case(s) FAILED`);
    process.exit(1);
}
console.log("\nAll late-cutoff cases passed.");
