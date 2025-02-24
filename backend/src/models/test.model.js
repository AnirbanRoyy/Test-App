import mongoose from "mongoose";

const testSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
        },
        questions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Question",
            },
        ],
        duration: {
            type: Number,
            required: true,
        },
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Teacher",
        },
        description: {
            type: String,
        },
        date: {
            type: Date,
            required: true,
        },
        time: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

export const Test = mongoose.model("Test", testSchema);
