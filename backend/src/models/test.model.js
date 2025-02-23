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
    },
    { timestamps: true }
);

export const Test = mongoose.model("Test", testSchema);
