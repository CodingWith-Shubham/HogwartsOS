import mongoose, { Schema } from "mongoose";

const salesTeamSchema = new Schema({
    refCode: {
        type: String,
        required: true,
        unique: true
    },
    salespersonName: {
        type: String,
        required: true
    },
    waNumber: {
        type: String,
        default: ""
    },
    expertise: {
        type: String,
        default: ""
    },
    salespersonEmail: {
        type: String,
        default: ""
    }
}, { timestamps: true });

export const SalesTeam = mongoose.model("SalesTeam", salesTeamSchema);
