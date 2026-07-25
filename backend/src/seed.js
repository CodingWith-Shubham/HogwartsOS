import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import connectDB from "./db/dbConnection.js";
import { User } from "./models/user.models.js";
import { Client } from "./models/client.models.js";
import { SalesTeam } from "./models/sales.models.js";
import { Payment } from "./models/payment.models.js";
import { Shoot } from "./models/shoot.models.js";
import { EditProject, EditingTask } from "./models/editing.models.js";
import { Revision } from "./models/revision.models.js";

dotenv.config();

const employeesData = [
    { empId: "u1", name: "Isha Malhotra", email: "isha@hogwartsstudios.com", phone: "9667474789", designation: "Branch Head", role: "manager", initials: "IM", username: "isha", redirectTo: "/manager", password: "isha123" },
    { empId: "u2", name: "Krishna Tiwari", email: "shubhammamgain_ec24a14_021@dtu.ac.in", phone: "9717817121", designation: "Sales & Marketing Executive", role: "sales", initials: "KT", username: "krishna", redirectTo: "/sales", password: "krishna123" },
    { empId: "u3", name: "Shubham Singh Rana", email: "mamgai75@gmail.com", phone: "9870875693", designation: "Executive - Creative Team", role: "editor", initials: "SSR", username: "shubham", redirectTo: "/editor", password: "shubham123" },
    { empId: "u4", name: "Deepak Sharma", email: "deepak@hogwartsstudios.com", phone: "7404409453", designation: "Manager - Creative Team", role: "editor", initials: "DS", username: "deepak", redirectTo: "/editor", password: "deepak123" },
    { empId: "u5", name: "Mayank Saxena", email: "mayank@hogwartsstudios.com", phone: "9149325621", designation: "Manager - Production Team", role: "shoot", initials: "MS", username: "mayank", redirectTo: "/shoot", password: "mayank123" },
    { empId: "u6", name: "Krishan Kunal Bagoria", email: "Krishanbagoria@gmail.com", phone: "8368065462", designation: "Founder / CEO", role: "manager", initials: "KK", username: "kkb", redirectTo: "/manager", password: "kkb123" },
    { empId: "u7", name: "Pallavi Jyoti", email: "pallavijyotisrivastav@gmail.com", phone: "918546028299", designation: "Co-Founder | CHRO", role: "manager", initials: "PJ", username: "pallavi", redirectTo: "/manager", password: "Kunal@2312" }
];

const clientsData = [
    { leadId: "HL-MRUJE2WM-IVXZ", phoneNumber: "919315599887", date: "21/07/2026", adRefCode: "aisensy", source: "Manual Entry", assignedTo: "Krishan Kunal Bagoria", name: "Aisensy", reachoutDone: "Yes", servicePitched: "Podcast", cost: 1200, status: "Payment Verified", clientEmail: "mamgainshubham18@gmail.com", proposalSent: true, proposalAccepted: true, proposalSentAt: "2026-07-21T10:55:59.904Z", podcastEdit: "0", reelEdit: "0", longFormatVideo: "0" },
    { leadId: "HL-MRUPO9GR-OZFM", phoneNumber: "89809843", date: "21/07/2026", adRefCode: "rohittechsolutions", source: "Manual Entry", assignedTo: "Isha Malhotra", name: "Rohit tech solutions", reachoutDone: "Yes", servicePitched: "Podcast", cost: 1230, status: "Payment Verified", clientEmail: "mamgainshubham18@gmail.com", proposalSent: true, proposalAccepted: true, proposalSentAt: "2026-07-21T13:51:41.712Z", podcastEdit: "0", reelEdit: "0", longFormatVideo: "0" },
    { leadId: "HL-MRUQ0XII-KIS5", phoneNumber: "342423432", date: "21/07/2026", adRefCode: "kkbshow", source: "Manual Entry", assignedTo: "Isha Malhotra", name: "kkbshow", reachoutDone: "Yes", servicePitched: "Podcast", cost: 14000, status: "Payment Verified", clientEmail: "mamgainshubham18@gmail.com", proposalSent: true, proposalAccepted: true, proposalSentAt: "2026-07-22T18:35:19.466Z", podcastEdit: "0", reelEdit: "10", longFormatVideo: "0" },
    { leadId: "HL-MRXG6B1W-5JL0", phoneNumber: "34342343", date: "23/07/2026", adRefCode: "dtushoot", source: "Manual Entry", assignedTo: "Isha Malhotra", name: "dtushoot", reachoutDone: "Yes", servicePitched: "Reel", cost: 12000, status: "Payment Completed", clientEmail: "mamgainshubham18@gmail.com", proposalSent: true, proposalAccepted: true, proposalSentAt: "2026-07-23T11:49:54.226Z", podcastEdit: "0", reelEdit: "14", longFormatVideo: "0" },
    { leadId: "HL-MRXGVPNM-ODC2", phoneNumber: "917668284479", date: "23/07/2026", adRefCode: "Krishna Tiwari", source: "Manual Entry", assignedTo: "Krishan Kunal Bagoria", name: "Krishna Tiwari Editing", reachoutDone: "Yes", servicePitched: "Podcast", cost: 10000, status: "Shoot Scheduled", clientEmail: "krishna.tiwari@hogwartsstudios.com", proposalSent: true, proposalAccepted: true, proposalSentAt: "2026-07-23T12:08:14.025Z", podcastEdit: "1", reelEdit: "5", longFormatVideo: "0" },
    { leadId: "HL-MRYM3END-C4NK", phoneNumber: "919315599887", date: "24/07/2026", adRefCode: "kkkbshowhogwarts", source: "Manual Entry", assignedTo: "Isha Malhotra", name: "kkbshowhogwarts", reachoutDone: "Yes", servicePitched: "Podcast", cost: 15000, status: "Shoot Scheduled", clientEmail: "Krishanbagoria@gmail.com", proposalSent: true, proposalAccepted: true, proposalSentAt: "2026-07-24T07:25:14.830Z", podcastEdit: "1", reelEdit: "5", longFormatVideo: "0" }
];

const salesTeamData = [
    { refCode: "PODCAST_ISHA", salespersonName: "Isha Malhotra", waNumber: "919315599887", expertise: "Podcast", salespersonEmail: "shubhammamgain_ec24a14_021@dtu.ac.in" },
    { refCode: "REELS_KRISHNA", salespersonName: "Krishna Tiwari", waNumber: "919315599887", expertise: "Reels", salespersonEmail: "mamgainshubham18@gmail.com" },
    { refCode: "SHOOTS_RAVI", salespersonName: "Deepak Sharma", waNumber: "919315599887", expertise: "Shoots", salespersonEmail: "mamgainshubham18@gmail.com" },
    { refCode: "CEO_KRISHAN", salespersonName: "Krishan Kunal Bagoria", waNumber: "919315599887", expertise: "Founder", salespersonEmail: "shubhammamgain_ec24a14_021@dtu.ac.in" }
];

const paymentsData = [
    { paymentId: "PAY_1784631442396", leadId: "HL-MRUJE2WM-IVXZ", clientName: "Aisensy", amount: 600, paymentLinkSent: true, paymentLinkSentAt: "2026-07-21T10:57:22.396Z", screenshotUrl: "https://drive.google.com/file/d/1884Qa5o1N4rtt5ZI65LkMROyWB0vLcv_/view?usp=drivesdk", utrNumber: "Not provided", paymentStatus: "Payment Verified", verifiedBy: "Krishan Kunal Bagoria", verifiedAt: "2026-07-21T10:58:55.287Z", totalCost: 1200, remainingAmount: 600, paymentCompleted: false, installmentNumber: "2", installmentLabel: "Day Before Shoot", paymentMode: "Online", amountPaidSoFar: 600 },
    { paymentId: "PAY_1784641589786", leadId: "HL-MRUJE2WM-IVXZ", clientName: "Aisensy", amount: 300, paymentLinkSent: true, paymentLinkSentAt: "2026-07-21T13:46:29.786Z", screenshotUrl: "https://drive.google.com/file/d/1RWP5N7O9dtDxf0raDdAlefCTBnRViAT-/view?usp=drivesdk", utrNumber: "Not provided", paymentStatus: "Payment Verified", verifiedBy: "Krishan Kunal Bagoria", verifiedAt: "2026-07-21T13:49:53.771Z", totalCost: 1200, remainingAmount: 300, paymentCompleted: false, installmentNumber: "2", installmentLabel: "Advance", paymentMode: "Online", amountPaidSoFar: 900 },
    { paymentId: "PAY_1784641952329", leadId: "HL-MRUPO9GR-OZFM", clientName: "Rohit tech solutions", amount: 615, paymentLinkSent: true, paymentLinkSentAt: "2026-07-21T13:52:32.329Z", screenshotUrl: "https://drive.google.com/file/d/1iBQiQROJTlYL5FwZlKRzy38P7n-vd6aU/view?usp=drivesdk", utrNumber: "Not provided", paymentStatus: "Payment Verified", verifiedBy: "Krishan Kunal Bagoria", verifiedAt: "2026-07-21T14:08:39.488Z", totalCost: 1230, remainingAmount: 615, paymentCompleted: false, installmentNumber: "2", installmentLabel: "Advance", paymentMode: "Online", amountPaidSoFar: 615 },
    { paymentId: "PAY_1784643908125", leadId: "HL-MRUPO9GR-OZFM", clientName: "Rohit tech solutions", amount: 307.5, paymentLinkSent: true, paymentLinkSentAt: "2026-07-21T14:25:08.125Z", screenshotUrl: "https://drive.google.com/file/d/1yrEYsEUEs-kwihPqy1QJEkpKzqOO6ctv/view?usp=drivesdk", utrNumber: "Not provided", paymentStatus: "Payment Verified", verifiedBy: "Krishan Kunal Bagoria", verifiedAt: "2026-07-23T11:38:59.689Z", totalCost: 1230, remainingAmount: 307.5, paymentCompleted: false, installmentNumber: "2", installmentLabel: "Advance", paymentMode: "Online", amountPaidSoFar: 922.5 },
    { paymentId: "PAY_1784745424109", leadId: "HL-MRUQ0XII-KIS5", clientName: "kkbshow", amount: 7000, paymentLinkSent: true, paymentLinkSentAt: "2026-07-22T18:37:04.109Z", screenshotUrl: "https://drive.google.com/file/d/11-gvlJ3dNw5ggBd__47-t9sDo-A75k0O/view?usp=drivesdk", utrNumber: "Not provided", paymentStatus: "Payment Verified", verifiedBy: "Krishan Kunal Bagoria", verifiedAt: "2026-07-22T18:38:26.176Z", totalCost: 14000, remainingAmount: 7000, paymentCompleted: false, installmentNumber: "2", installmentLabel: "Advance", paymentMode: "Online", amountPaidSoFar: 7000 },
    { paymentId: "PAY_1784745424110", leadId: "HL-MRUQ0XII-KIS5", clientName: "kkbshow", amount: 7000, paymentLinkSent: true, paymentLinkSentAt: "2026-07-23T09:00:19.659+05:30", paymentStatus: "Balance Link Sent", totalCost: 14000, remainingAmount: 7000, paymentCompleted: false, installmentLabel: "Day Before Shoot", paymentMode: "Online" },
    { paymentId: "PAY_1784806585138", leadId: "HL-MRUQ0XII-KIS5", clientName: "kkbshow", amount: 3500, paymentLinkSent: true, paymentLinkSentAt: "2026-07-23T11:36:25.138Z", screenshotUrl: "https://drive.google.com/file/d/1BGqENZK1TwNKEwsPVTrXghzXPi9v6Ypf/view?usp=drivesdk", utrNumber: "Not provided", paymentStatus: "Payment Verified", verifiedBy: "Krishan Kunal Bagoria", verifiedAt: "2026-07-23T11:38:16.415Z", totalCost: 14000, remainingAmount: 3500, paymentCompleted: false, installmentNumber: "2", installmentLabel: "Advance", paymentMode: "Online", amountPaidSoFar: 10500 },
    { paymentId: "PAY_1784807484574", leadId: "HL-MRXG6B1W-5JL0", clientName: "dtushoot", amount: 6000, paymentLinkSent: true, paymentLinkSentAt: "2026-07-23T11:51:24.574Z", screenshotUrl: "https://drive.google.com/file/d/1M65oulnq95kDYqC-H_Senen6z6i4P29j/view?usp=drivesdk", utrNumber: "Not provided", paymentStatus: "Payment Verified", verifiedBy: "Krishan Kunal Bagoria", verifiedAt: "2026-07-23T11:52:32.776Z", totalCost: 12000, remainingAmount: 6000, paymentCompleted: false, installmentNumber: "2", installmentLabel: "Advance", paymentMode: "Online", amountPaidSoFar: 6000 },
    { paymentId: "PAY_1784807750811", leadId: "HL-MRXG6B1W-5JL0", clientName: "dtushoot", amount: 6000, paymentLinkSent: false, paymentLinkSentAt: "2026-07-23T11:55:50.811Z", paymentStatus: "Cash Received", totalCost: 12000, remainingAmount: 0, paymentCompleted: true, installmentNumber: "2", installmentLabel: "Advance", paymentMode: "Cash", cashCollectedBy: "Krishan Kunal Bagoria", amountPaidSoFar: 6000 },
    { paymentId: "PAY_1784808549644", leadId: "HL-MRXGVPNM-ODC2", clientName: "Krishna Tiwari Editing", amount: 3000, paymentLinkSent: true, paymentLinkSentAt: "2026-07-23T12:09:09.644Z", screenshotUrl: "https://drive.google.com/file/d/1G1QladMoW_pTUOAQPd3KgfBYcNkDgLg5/view?usp=drivesdk", utrNumber: "Not provided", paymentStatus: "Payment Verified", verifiedBy: "Krishan Kunal Bagoria", verifiedAt: "2026-07-23T12:10:06.617Z", totalCost: 10000, remainingAmount: 7000, paymentCompleted: false, installmentNumber: "2", installmentLabel: "Advance", paymentMode: "Online", amountPaidSoFar: 3000 },
    { paymentId: "PAY_1784877975389", leadId: "HL-MRYM3END-C4NK", clientName: "kkbshowhogwarts", amount: 7500, paymentLinkSent: true, paymentLinkSentAt: "2026-07-24T07:26:15.389Z", screenshotUrl: "https://drive.google.com/file/d/1epkBf6NI975phU12_i_WaY82cBGchESX/view?usp=drivesdk", utrNumber: "Not provided", paymentStatus: "Payment Verified", verifiedBy: "Krishan Kunal Bagoria", verifiedAt: "2026-07-24T07:28:37.814Z", totalCost: 15000, remainingAmount: 7500, paymentCompleted: false, installmentNumber: "2", installmentLabel: "Advance", paymentMode: "Online", amountPaidSoFar: 7500 },
    { paymentId: "PAY_1784878192601", leadId: "HL-MRYM3END-C4NK", clientName: "kkbshowhogwarts", amount: 2000, paymentLinkSent: true, paymentLinkSentAt: "2026-07-24T07:29:52.601Z", screenshotUrl: "https://drive.google.com/file/d/1EYqaMsZcbYpXsSNyhghyHhHNSU2Nf0N3/view?usp=drivesdk", utrNumber: "Not provided", paymentStatus: "Payment Verified", verifiedBy: "Krishan Kunal Bagoria", verifiedAt: "2026-07-24T07:30:53.377Z", totalCost: 15000, remainingAmount: 5500, paymentCompleted: false, installmentNumber: "2", installmentLabel: "Advance", paymentMode: "Online", amountPaidSoFar: 9500 }
];

const shootsData = [
    { shootId: "SHOOT_1784632432260", leadId: "HL-MRUJE2WM-IVXZ", clientName: "Aisensy", contactNum: "919315599887", clientEmailId: "mamgainshubham18@gmail.com", shootDate: "2026-07-22", shootStartTime: "13:30", shootEndTime: "15:00", camera: "1", teleprompter: "No", totalHours: "1.5", assignedTo: "Krishan Kunal Bagoria", bts: "No", shootMemberName: "Mayank Saxena", shootMemberEmail: "tripxpay@gmail.com", driveLinkUploaded: true, setName: "Green Amazon", handoverTo: "Aisensy" },
    { shootId: "SHOOT_1784643105711", leadId: "HL-MRUPO9GR-OZFM", clientName: "Rohit tech solutions", contactNum: "89809843", clientEmailId: "mamgainshubham18@gmail.com", shootDate: "2026-07-22", shootStartTime: "14:00", shootEndTime: "16:00", camera: "1", teleprompter: "No", totalHours: "2", assignedTo: "Isha Malhotra", bts: "No", shootMemberName: "Mayank Saxena", shootMemberEmail: "mamgainshubham18@gmail.com", driveLinkUploaded: false, setName: "Entire Studio" },
    { shootId: "SHOOT_1784745558644", leadId: "HL-MRUQ0XII-KIS5", clientName: "kkbshow", contactNum: "342423432", clientEmailId: "mamgainshubham18@gmail.com", shootDate: "2026-07-24", shootStartTime: "14:00", shootEndTime: "15:00", camera: "1", teleprompter: "No", totalHours: "1", assignedTo: "Isha Malhotra", bts: "No", shootMemberName: "Mayank Saxena", shootMemberEmail: "mamgai75@gmail.com", dataLink: "https://app.fireflies.ai/view/Catch-up::01KXZAC28Q8F48QT2XC6TB81DK?ref=recap", driveLinkUploaded: true, recordTime: "4:00", studioTime: "2:01", extraCamera: "10", extraTeleprompter: "15", extraDurationHours: "12", additionalCost: "120", setName: "Green Amazon", addonHasAddons: "yes", addonPaymentStatus: "verified" },
    { shootId: "SHOOT_1784807676779", leadId: "HL-MRXG6B1W-5JL0", clientName: "dtushoot", contactNum: "34342343", clientEmailId: "mamgainshubham18@gmail.com", shootDate: "2026-07-24", shootStartTime: "14:00", shootEndTime: "16:00", camera: "1", teleprompter: "No", totalHours: "2", assignedTo: "Isha Malhotra", bts: "No", shootMemberName: "Mayank Saxena", shootMemberEmail: "tripxpay@gmail.com", dataLink: "https://hogwarts-studio-crm.vercel.app/shoot", driveLinkUploaded: true, testimonials: "charge accordingly", recordTime: "1", studioTime: "2", extraCamera: "10", extraTeleprompter: "0", extraDurationHours: "0", additionalCost: "800", shootNotes: "charge accordingly", setName: "Cyclorama Chroma Screen", addonHasAddons: "yes", addonPaymentStatus: "verified" },
    { shootId: "SHOOT_1784808652797", leadId: "HL-MRXGVPNM-ODC2", clientName: "Krishna Tiwari Editing", contactNum: "917668284479", clientEmailId: "krishna.tiwari@hogwartsstudios.com", shootDate: "2026-07-24", shootStartTime: "13:00", shootEndTime: "15:00", camera: "2", teleprompter: "No", totalHours: "2", assignedTo: "Krishan Kunal Bagoria", bts: "Yes", shootMemberName: "Mayank Saxena", shootMemberEmail: "mayank@hogwartsstudios.com", driveLinkUploaded: true, setName: "Black Money", handoverTo: "Krishna Tiwari" },
    { shootId: "SHOOT_1784880284726", leadId: "HL-MRYM3END-C4NK", clientName: "kkbshowhogwarts", contactNum: "919315599887", clientEmailId: "Krishanbagoria@gmail.com", shootDate: "2026-07-25", shootStartTime: "15:03", shootEndTime: "17:03", camera: "1", teleprompter: "Yes", totalHours: "2", assignedTo: "Isha Malhotra", bts: "Yes", shootMemberName: "Mayank Saxena", shootMemberEmail: "mamgainshubham18@gmail.com", dataLink: "https://drive.google.com/file/d/1epkBf6NI975phU12_i_WaY82cBGchESX/view", driveLinkUploaded: true, recordTime: "1", studioTime: "1", extraCamera: "1", extraTeleprompter: "2", extraDurationHours: "1", additionalCost: "5000", setName: "Green Amazon", addonHasAddons: "yes", addonPaymentStatus: "verified" }
];

const editingTasksRaw = [
    { taskId: "TASK_1784794753429_1", editId: "EDIT_1784794753428", shootId: "SHOOT_1784632432260", leadId: "HL-MRUJE2WM-IVXZ", clientName: "Aisensy", emailId: "mamgainshubham18@gmail.com", serviceType: "Podcast", taskType: "teaser_edit", taskIndex: 1, taskLabel: "Teaser Edit #1", dataLink: "https://app.fireflies.ai/view/Catch-up::01KXZAC28Q8F48QT2XC6TB81DK?ref=recap", assignedToName: "Shubham Singh Rana", assignedToEmail: "shubham@hogwartsstudios.com", status: "Assigned", managerComment: "do it asap", revisionCount: 0, maxFreeRevisions: 2, extraRevisionApproved: false },
    { taskId: "TASK_1784794753429_2", editId: "EDIT_1784794753428", shootId: "SHOOT_1784632432260", leadId: "HL-MRUJE2WM-IVXZ", clientName: "Aisensy", emailId: "mamgainshubham18@gmail.com", serviceType: "Podcast", taskType: "teaser_edit", taskIndex: 2, taskLabel: "Teaser Edit #2", dataLink: "https://app.fireflies.ai/view/Catch-up::01KXZAC28Q8F48QT2XC6TB81DK?ref=recap", assignedToName: "Shubham Singh Rana", assignedToEmail: "shubham@hogwartsstudios.com", status: "Assigned", managerComment: "do it asap", revisionCount: 0, maxFreeRevisions: 2, extraRevisionApproved: false },
    { taskId: "TASK_1784794753429_21", editId: "EDIT_1784794753428", shootId: "SHOOT_1784632432260", leadId: "HL-MRUJE2WM-IVXZ", clientName: "Aisensy", emailId: "mamgainshubham18@gmail.com", serviceType: "Podcast", taskType: "thumbnail_edit", taskIndex: 1, taskLabel: "Thumbnail Edit #1", dataLink: "https://app.fireflies.ai/view/Catch-up::01KXZAC28Q8F48QT2XC6TB81DK?ref=recap", assignedToName: "Deepak Sharma", assignedToEmail: "deepak@hogwartsstudios.com", status: "Assigned", managerComment: "do it asap", revisionCount: 0, maxFreeRevisions: 2, extraRevisionApproved: false },
    { taskId: "TASK_1784881148431_1", editId: "EDIT_1784881148431", shootId: "SHOOT_1784880284726", leadId: "HL-MRYM3END-C4NK", clientName: "kkbshowhogwarts", emailId: "Krishanbagoria@gmail.com", serviceType: "Podcast", taskType: "podcast_edit", taskIndex: 1, taskLabel: "Podcast Edit #1", dataLink: "https://drive.google.com/file/d/1epkBf6NI975phU12_i_WaY82cBGchESX/view", assignedToName: "Deepak Sharma", assignedToEmail: "mamgai75@gmail.com", status: "Assigned", managerComment: "XYZZZZ", revisionCount: 0, maxFreeRevisions: 2, extraRevisionApproved: false }
];

const seedDB = async () => {
    try {
        await connectDB();
        console.log("🌱 Starting Database Seeding...");

        // 1. Seed Employees
        for (const emp of employeesData) {
            const hashedPassword = await bcrypt.hash(emp.password, 10);
            await User.findOneAndUpdate(
                { email: emp.email.toLowerCase() },
                { ...emp, password: hashedPassword },
                { upsert: true, new: true }
            );
        }
        console.log("✅ Seeded Employees (7 records)");

        // 2. Seed Clients
        for (const client of clientsData) {
            await Client.findOneAndUpdate({ leadId: client.leadId }, client, { upsert: true, new: true });
        }
        console.log("✅ Seeded Clients (6 records)");

        // 3. Seed Sales Team
        for (const sale of salesTeamData) {
            await SalesTeam.findOneAndUpdate({ refCode: sale.refCode }, sale, { upsert: true, new: true });
        }
        console.log("✅ Seeded Sales Team (4 records)");

        // 4. Seed Payments
        for (const pay of paymentsData) {
            if (pay.paymentId) {
                await Payment.findOneAndUpdate({ paymentId: pay.paymentId }, pay, { upsert: true, new: true });
            } else {
                await Payment.create(pay);
            }
        }
        console.log("✅ Seeded Payments (12 records)");

        // 5. Seed Shoots
        for (const shoot of shootsData) {
            await Shoot.findOneAndUpdate({ shootId: shoot.shootId }, shoot, { upsert: true, new: true });
        }
        console.log("✅ Seeded Shoots (6 records)");

        // 6. Seed Edit Projects & Tasks
        await EditProject.findOneAndUpdate(
            { editId: "EDIT_1784794753428" },
            { editId: "EDIT_1784794753428", shootId: "SHOOT_1784632432260", leadId: "HL-MRUJE2WM-IVXZ", clientName: "Aisensy", emailId: "mamgainshubham18@gmail.com", status: "Assigned", editorName: "Shubham Singh Rana", editorEmail: "shubham@hogwartsstudios.com", serviceType: "Podcast" },
            { upsert: true, new: true }
        );

        await EditProject.findOneAndUpdate(
            { editId: "EDIT_1784881148431" },
            { editId: "EDIT_1784881148431", shootId: "SHOOT_1784880284726", leadId: "HL-MRYM3END-C4NK", clientName: "kkbshowhogwarts", emailId: "Krishanbagoria@gmail.com", status: "Assigned", editorName: "Deepak Sharma", editorEmail: "mamgai75@gmail.com", serviceType: "Podcast" },
            { upsert: true, new: true }
        );

        for (const task of editingTasksRaw) {
            await EditingTask.findOneAndUpdate({ taskId: task.taskId }, task, { upsert: true, new: true });
        }
        console.log("✅ Seeded Edit Projects & Tasks");

        console.log("🎉 Database Seeding Completed Successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error seeding database:", err);
        process.exit(1);
    }
};

seedDB();
