import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
        },
        test: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Test",
            required: true,
        },
        answers: [
            {
                question: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Question",
                },
                answer: {
                    type: String,
                },
            },
        ],
        score: {
            type: Number,
        },
    },
    { timestamps: true }
);

export const Submission = mongoose.model("Submission", submissionSchema);
