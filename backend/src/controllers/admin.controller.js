import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Admin } from "../models/admin.model.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.js";
import fs from "fs";

const registerAdmin = asyncHandler(async (req, res) => {
    const { name, email, phone, password } = req.body;

    if ([name, email, phone, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
        throw new ApiError(400, "Admin already exists");
    }

    const admin = await Admin.create({
        name,
        email,
        phone,
        password,
    });

    const createdAdmin = await Admin.findById(admin?._id).select("-password");
    if (!createdAdmin) {
        throw new ApiError(500, "Admin not created");
    }

    res.status(201).json(
        new ApiResponse(201, createdAdmin, "Admin registered successfully")
    );
});

const generateTokens = async (adminId) => {
    try {
        const admin = await Admin.findById(adminId);
        if (!admin) {
            throw new ApiError(404, "Admin not found");
        }

        const accessToken = admin.generateAccessToken();
        const refreshToken = admin.generateRefreshToken();

        admin.refreshToken = refreshToken;
        await admin.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Token generation failed");
    }
};

const loginAdmin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if ([email, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
        throw new ApiError(404, "Admin not found");
    }

    if (!admin.isPasswordCorrect(password)) {
        throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = await generateTokens(admin._id);

    const loggedInAdmin = await Admin.findById(admin._id).select(
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
            new ApiResponse(200, loggedInAdmin, "Admin logged in successfully")
        );
});

const logoutAdmin = asyncHandler(async (req, res) => {
    const { admin } = req;

    await Admin.findByIdAndUpdate(
        admin?._id,
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
        .json(new ApiResponse(200, null, "Admin logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies?.refreshToken ||
        req.header("Authorization").replace("Bearer ", "");
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Admin trying to Refresh Tokens");
    }

    const decoded = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    );

    const admin = await Admin.findById(decoded?.id);
    if (!admin) {
        throw new ApiError(401, "Unauthorized Admin trying to Refresh Tokens");
    }

    if (admin.refreshToken !== incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Admin trying to Refresh Tokens");
    }

    const { accessToken, refreshToken } = await generateTokens(admin._id);

    admin.refreshToken = refreshToken;
    await admin.save({ validateBeforeSave: false });

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

    const admin = await Admin.findById(req.admin?._id);

    const isPasswordValid = await admin.isPasswordCorrect(oldPassword);
    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid old password");
    }

    admin.password = newPassword;
    await admin.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Admin password updated successfully!"));
});

const getCurrentAdmin = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                req.admin,
                "Current Admin details sent successfully"
            )
        );
});

const updateAdminDetails = asyncHandler(async (req, res) => {
    const { email, name, phone } = req.body;

    if (!email && !name && !phone) {
        throw new ApiError(400, "Send at least one field to update");
    }

    const admin = await Admin.findByIdAndUpdate(
        req.admin._id,
        {
            $set: {
                email: email || req.admin.email,
                name: name || req.admin.name,
                phone: phone || req.admin.phone,
            },
        },
        {
            new: true,
        }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(
            new ApiResponse(200, admin, "Admin details updated successfully")
        );
});

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar Local Path not found to update");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const oldAvatarUrl = req?.admin?.avatar;
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

    const admin = await Admin.findByIdAndUpdate(
        req.admin._id,
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
        .json(new ApiResponse(200, admin, "Avatar updated successfully"));
});

export {
    registerAdmin,
    loginAdmin,
    logoutAdmin,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentAdmin,
    updateAdminDetails,
    updateAvatar,
};
