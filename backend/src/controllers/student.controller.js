import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Student } from "../models/student.model.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.js";
import fs from "fs";

const registerStudent = asyncHandler(async (req, res) => {
    const { name, universityRollNo, email, phone, password, course } = req.body;

    if (
        [name, universityRollNo, email, phone, password, course].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    const existingStudent = await Student.findOne({
        $or: [{ universityRollNo }, { email }],
    });
    if (existingStudent) {
        throw new ApiError(400, "Student already exists");
    }

    const student = await Student.create({
        name,
        universityRollNo,
        email,
        phone,
        password,
        course,
    });

    const createdStudent = await Student.findById(student?._id).select(
        "-password"
    );
    if (!createdStudent) {
        throw new ApiError(500, "Student not created");
    }

    res.status(201).json(
        new ApiResponse(201, createdStudent, "Student registered successfully")
    );
});

const generateTokens = async (studentId) => {
    try {
        const student = await Student.findById(studentId);
        if (!student) {
            throw new ApiError(404, "Student not found");
        }

        const accessToken = student.generateAccessToken();
        const refreshToken = student.generateRefreshToken();

        student.refreshToken = refreshToken;
        await student.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Token generation failed");
    }
};

const loginStudent = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if ([email, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const student = await Student.findOne({ email });
    if (!student) {
        throw new ApiError(404, "Student not found");
    }

    if (!student.isPasswordCorrect(password)) {
        throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = await generateTokens(student._id);

    const loggedInStudent = await Student.findById(student._id).select(
        "-password -refreshToken"
    );

    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new ApiResponse(
                200,
                loggedInStudent,
                "Student logged in successfully"
            )
        );
});

const logoutStudent = asyncHandler(async (req, res) => {
    const { student } = req;

    // remove the refresh token from DB
    await Student.findByIdAndUpdate(
        student?._id,
        {
            $set: {
                refreshToken: null,
            },
        },
        {
            new: true,
        }
    );

    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new ApiResponse(200, null, "Student logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies?.refreshToken ||
        req.header("Authorization").replace("Bearer ", "");
    if (!incomingRefreshToken) {
        throw new ApiError(
            401,
            "Unauthorized Student trying to Refresh Tokens"
        );
    }

    const decoded = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    );

    const student = await Student.findById(decoded?.id);
    if (!student) {
        throw new ApiError(
            401,
            "Unauthorized Student trying to Refresh Tokens"
        );
    }

    if (student.refreshToken !== incomingRefreshToken) {
        throw new ApiError(
            401,
            "Unauthorized Student trying to Refresh Tokens"
        );
    }

    // generate access and refresh tokens
    const { accessToken, refreshToken } = await generateTokens(student._id);

    student.refreshToken = refreshToken;
    await student.save({ validateBeforeSave: false });

    const cookieOptions = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new ApiResponse(200, null, "Tokens refreshed successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const student = await Student.findById(req.student?._id);

    const isPasswordValid = await student.isPasswordCorrect(oldPassword);
    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid old password");
    }

    student.password = newPassword;
    await student.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Student password updated successfully!")
        );
});

const getCurrentStudent = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.student,
                "Current Student details sent successfully"
            )
        );
});

const updateStudentDetails = asyncHandler(async (req, res) => {
    const { email, name, phone, course } = req.body;

    if (!email && !name && !phone && !course) {
        throw new ApiError(400, "Send at least one field to update");
    }

    const student = await Student.findByIdAndUpdate(
        req.student._id,
        {
            $set: {
                email: email || req.student.email,
                name: name || req.student.name,
                phone: phone || req.student.phone,
                course: course || req.student.course,
            },
        },
        {
            new: true,
        }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                student,
                "Student details updated successfully"
            )
        );
});

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar Local Path not found to update");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const oldAvatarUrl = req?.student?.avatar;
    if (!oldAvatarUrl) {
        throw new ApiError(401, "Old avatar URL not found");
    }

    deleteFromCloudinary(oldAvatarUrl);

    fs.unlinkSync(avatarLocalPath);

    if (!avatar) {
        throw new ApiError(
            401,
            "Failed to upload on cloudinary while updating"
        );
    }

    const student = await Student.findByIdAndUpdate(
        req.student._id,
        {
            $set: {
                avatar: avatar.url,
            },
        },
        {
            new: true,
        }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(new ApiResponse(200, student, "Avatar updated successfully"));
});

export {
    registerStudent,
    loginStudent,
    logoutStudent,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentStudent,
    updateStudentDetails,
    updateAvatar,
};
