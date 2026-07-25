import nodemailer from "nodemailer";
import Mailgen from "mailgen";
import dotenv from "dotenv";
dotenv.config({
    path: "./.env"
});

const sendMail = async ({
    email,
    subject,
    mailgenContent
}) => {
    try {
        const html = mailGenerator.generate(mailgenContent);
        const text = mailGenerator.generatePlaintext(mailgenContent);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject,
            text,
            html
        };

        const info = await transporter.sendMail(mailOptions);

        console.log("Email sent:", info.messageId);

        return info;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
};


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const mailGenerator = new Mailgen({
    theme: "default",
    product: {
        name: "Task Manager",
        link: process.env.CLIENT_URL || "http://localhost:3000"
    }
});

export const emailVerificationMailgenContent = (
    username,
    verificationUrl
) => {
    return {
        body: {
            name: username,
            intro:
                "Welcome to our app! We're very excited to have you on board.",

            action: {
                instructions:
                    "To verify your email address, please click the button below:",
                button: {
                    color: "#22BC66",
                    text: "Verify Email",
                    link: verificationUrl
                }
            },

            outro:
                "Need help, or have questions? Just reply to this email, we'd love to help."
        }
    };
};

export const forgotPasswordMailgenContent = (
    username,
    passwordResetUrl
) => {
    return {
        body: {
            name: username,

            intro:
                "You requested to reset your password for your account.",

            action: {
                instructions:
                    "To reset your password, please click the button below:",
                button: {
                    color: "#DC4D2F",
                    text: "Reset Password",
                    link: passwordResetUrl
                }
            },

            outro:
                "If you did not request a password reset, please ignore this email."
        }
    };
};



export default sendMail;