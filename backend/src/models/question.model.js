import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
    {
        text: {
            type: String,
            required: true,
        },
        options: {
            type: [String],
            required: true,
        },
        answer: {
            type: String,
            required: true,
        },
        explanation: {
            type: String,
        },
    },
    { timestamps: true }
);

export const Question = mongoose.model("Question", questionSchema);
