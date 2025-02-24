import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

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
        tags: {
            course: {
                type: String,
                required: true,
            },
            difficulty: {
                type: String,
                enum: ["Easy", "Medium", "Hard"],
                required: true,
            },
        },
    },
    { timestamps: true }
);

questionSchema.plugin(mongooseAggregatePaginate);

export const Question = mongoose.model("Question", questionSchema);
