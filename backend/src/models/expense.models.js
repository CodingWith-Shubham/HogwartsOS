import mongoose, { Schema } from "mongoose";

const expenseSchema = new Schema({
    amount: {
        type: Number,
        required: true,
        default: 0
    },
    category: {
        type: String,
        required: true,
        default: 'Other'
    },
    description: {
        type: String,
        default: ""
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    recordedBy: {
        type: String,
        default: "System"
    }
}, { timestamps: true });

export const Expense = mongoose.model("Expense", expenseSchema);
