import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Teacher } from "../models/teacher.model.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.js";
import fs from "fs";

const registerTeacher = asyncHandler(async (req, res) => {
    const { name, employeeId, email, phone, password, department, role } =
        req.body;

    if (
        [name, employeeId, email, phone, password, department, role].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    const existingTeacher = await Teacher.findOne({
        $or: [{ employeeId }, { email }],
    });
    if (existingTeacher) {
        throw new ApiError(400, "Teacher already exists");
    }

    const teacher = await Teacher.create({
        name,
        employeeId,
        email,
        phone,
        password,
        department,
        role,
    });

    const createdTeacher = await Teacher.findById(teacher?._id).select(
        "-password"
    );
    if (!createdTeacher) {
        throw new ApiError(500, "Teacher not created");
    }

    res.status(201).json(
        new ApiResponse(201, createdTeacher, "Teacher registered successfully")
    );
});

const generateTokens = async (teacherId) => {
    try {
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            throw new ApiError(404, "Teacher not found");
        }

        const accessToken = teacher.generateAccessToken();
        const refreshToken = teacher.generateRefreshToken();

        teacher.refreshToken = refreshToken;
        await teacher.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Token generation failed");
    }
};

const loginTeacher = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if ([email, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
        throw new ApiError(404, "Teacher not found");
    }

    if (!teacher.isPasswordCorrect(password)) {
        throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = await generateTokens(teacher._id);

    const loggedInTeacher = await Teacher.findById(teacher._id).select(
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
                loggedInTeacher,
                "Teacher logged in successfully"
            )
        );
});

const logoutTeacher = asyncHandler(async (req, res) => {
    const { teacher } = req;

    await Teacher.findByIdAndUpdate(
        teacher?._id,
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
        .json(new ApiResponse(200, null, "Teacher logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies?.refreshToken ||
        req.header("Authorization").replace("Bearer ", "");
    if (!incomingRefreshToken) {
        throw new ApiError(
            401,
            "Unauthorized Teacher trying to Refresh Tokens"
        );
    }

    const decoded = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    );

    const teacher = await Teacher.findById(decoded?.id);
    if (!teacher) {
        throw new ApiError(
            401,
            "Unauthorized Teacher trying to Refresh Tokens"
        );
    }

    if (teacher.refreshToken !== incomingRefreshToken) {
        throw new ApiError(
            401,
            "Unauthorized Teacher trying to Refresh Tokens"
        );
    }

    const { accessToken, refreshToken } = await generateTokens(teacher._id);

    teacher.refreshToken = refreshToken;
    await teacher.save({ validateBeforeSave: false });

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

    const teacher = await Teacher.findById(req.teacher?._id);

    const isPasswordValid = await teacher.isPasswordCorrect(oldPassword);
    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid old password");
    }

    teacher.password = newPassword;
    await teacher.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Teacher password updated successfully!")
        );
});

const getCurrentTeacher = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.teacher,
                "Current Teacher details sent successfully"
            )
        );
});

const updateTeacherDetails = asyncHandler(async (req, res) => {
    const { email, name, phone, department, role } = req.body;

    if (!email && !name && !phone && !department && !role) {
        throw new ApiError(400, "Send at least one field to update");
    }

    const teacher = await Teacher.findByIdAndUpdate(
        req.teacher._id,
        {
            $set: {
                email: email || req.teacher.email,
                name: name || req.teacher.name,
                phone: phone || req.teacher.phone,
                department: department || req.teacher.department,
                role: role || req.teacher.role,
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
                teacher,
                "Teacher details updated successfully"
            )
        );
});

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar Local Path not found to update");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const oldAvatarUrl = req?.teacher?.avatar;
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

    const teacher = await Teacher.findByIdAndUpdate(
        req.teacher._id,
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
        .json(new ApiResponse(200, teacher, "Avatar updated successfully"));
});

export {
    registerTeacher,
    loginTeacher,
    logoutTeacher,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentTeacher,
    updateTeacherDetails,
    updateAvatar,
};
