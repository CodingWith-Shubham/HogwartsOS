import { User } from "../models/user.models.js";
import { classifyMissedDaysForUser } from "../controllers/leave.controllers.js";

// Runs after midnight in India. Completed missed days are classified without
// waiting for the employee or manager to open the attendance screen.
export const startAttendanceCron = () => {
    const run = async () => {
        try {
            const users = await User.find({}, "_id empId name email");
            await Promise.all(users.map(user => classifyMissedDaysForUser(user)));
            console.log("Attendance weekly-off/LOP classification completed");
        } catch (error) {
            console.error("Attendance classification cron failed:", error);
        }
    };
    const now = new Date();
    const nextRun = new Date(now);
    // 00:10 Asia/Kolkata is 18:40 UTC on the preceding day.
    const utcHour = 18;
    const utcMinute = 40;
    nextRun.setUTCHours(utcHour, utcMinute, 0, 0);
    if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    setTimeout(() => { run(); setInterval(run, 24 * 60 * 60 * 1000); }, nextRun.getTime() - now.getTime());
};
