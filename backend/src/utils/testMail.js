//A testing file for nodemailer. 
import dotenv from "dotenv";
dotenv.config({
    path: "./.env"
});
import sendMail from "./mail.js";

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS);

dotenv.config();

try {
    await sendMail({
        email: "a_valid_email@gmail.com",
        subject: "Nodemailer + Mailgen Test",
        mailgenContent: {
            body: {
                name: "Utkarsh",
                intro: "Your email setup is working successfully!"
            }
        }
    });

    console.log("Test email sent successfully!");
} catch (error) {
    console.error("Test failed:", error);
}