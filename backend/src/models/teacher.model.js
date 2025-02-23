import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const teacherSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
        },
        employeeId: {
            type: String,
            required: true,
            unique: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            unique: true,
        },
        phone: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            required: true,
        },
        department: {
            type: String,
            enum: ["BCA", "MCA", "CSE", "IT", "ECE", "MECH", "Others"],
            required: true,
        },
        role: {
            type: String,
            enum: [
                "HOD",
                "Professor",
                "Assistant Professor",
                "Lab Assistant",
                "Others",
            ],
            required: true,
        },
        avatar: {
            type: String,
            required: true,
        },
        refreshToken: {
            type: String,
        },
    },
    { timestamps: true }
);

teacherSchema.pre("save", function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    this.password = bcrypt.hashSync(this.password, 10);
    next();
});

teacherSchema.methods.isPasswordCorrect = function (password) {
    return bcrypt.compareSync(password, this.password);
};

teacherSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            id: this._id,
            name: this.name,
            email: this.email,
            phone: this.phone,
            department: this.department,
            role: this.role,
            user: "teacher",
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
    );
};

teacherSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            id: this._id,
            user: "teacher",
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
};

export const Teacher = mongoose.model("Teacher", teacherSchema);
