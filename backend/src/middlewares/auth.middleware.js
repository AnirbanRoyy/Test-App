import { Admin } from "../models/admin.model.js";
import { Student } from "../models/student.model.js";
import { Teacher } from "../models/teacher.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

const verifyJWT = asyncHandler(async (req, _, next) => {
    const token = req.header("Authorization").replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Token not found");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const typeOfUser = decoded?.user;

    if (typeOfUser === "student") {
        const student = await Student.findById(decoded.id).select(
            "-password -refreshToken"
        );

        if (!student) {
            throw new ApiError(401, "Unauthorized");
        }
        req.student = student;
    } else if (typeOfUser === "teacher") {
        const teacher = await Teacher.findById(decoded.id).select(
            "-password -refreshToken"
        );

        if (!teacher) {
            throw new ApiError(401, "Unauthorized");
        }
        req.teacher = teacher;
    } else if (typeOfUser === "admin") {
        const admin = await Admin.findById(decoded.id).select(
            "-password -refreshToken"
        );

        if (!admin) {
            throw new ApiError(401, "Unauthorized");
        }
        req.admin = admin;
    } else {
        throw new ApiError(401, "Unauthorized");
    }
    next();
});

export default verifyJWT;
