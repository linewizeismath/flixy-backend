import mongoose, { Types, isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    deleteFromCloudinary,
    getCloudinaryId,
    uploadOnCloudinary
} from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        query,
        sortBy = "createdAt",
        sortType = "desc",
        userId,
    } = req.query;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const skip = (pageInt - 1) * limitInt;

    let match = {
        isPublished: true
    };

    if (query) {
        match = {
            ...match,
            title: {
                $regex: query,
                $options: "i"
            }
        };
    }

    if (userId) {
        match = {
            ...match,
            owner: userId
        };
    }

    const aggregationPipeline = [
        {
            $match: match
        },
        {
            $sort: {
                [sortBy]: sortType === "desc" ? -1 : 1
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerInfo",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                ownerInfo: {
                    $arrayElemAt: ["$ownerInfo", 0]
                }
            }
        },
        {
            $facet: {
                metadata: [
                    {
                        $count: "total"
                    }
                ],
                data: [
                    {
                        $skip: skip
                    },
                    {
                        $limit: limitInt
                    }
                ]
            }
        },
        {
            $unwind: {
                path: "$metadata",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                total: "$metadata.total",
                data: 1,
                ownerInfo: 1
            }
        }
    ];

    const results = await Video.aggregate(aggregationPipeline);
    const result = results[0] || {
        total: 0,
        data: []
    };

    const totalVideos = result.total || 0;
    const totalPages = Math.ceil(totalVideos / limitInt);

    const pagination = {
        page: pageInt,
        limit: limitInt,
        first: 1,
        last: totalPages,
        prev: pageInt > 1 ? pageInt - 1 : null,
        next: pageInt < totalPages ? pageInt + 1 : null,
        totalPage: totalPages,
        totalVideos
    };

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                videos: result.data,
                pagination
            },
            "Videos retrieved successfully"
        )
    );
});


const uploadVideo = asyncHandler(async (req, res, next) => {
    const {
        title,
        description,
        tmdbId,
        type,
        season,
        episode
    } = req.body;

    // -----------------------------
    // Validate basic information
    // -----------------------------

    if (!title || typeof title !== "string") {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid or missing title"],
                "Title is required and must be a string"
            )
        );
    }

    if (!description || typeof description !== "string") {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid or missing description"],
                "Description is required and must be a string"
            )
        );
    }

    if (!tmdbId || isNaN(Number(tmdbId))) {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid or missing TMDB ID"],
                "TMDB ID is required and must be a number"
            )
        );
    }

    if (!type || !["movie", "tv"].includes(type)) {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid media type"],
                'Type must be either "movie" or "tv"'
            )
        );
    }

    // TV requires season and episode.
    // Movies do not.
    let finalSeason = null;
    let finalEpisode = null;

    if (type === "tv") {
        if (
            season === undefined ||
            season === null ||
            isNaN(Number(season))
        ) {
            return next(
                new ApiError(
                    400,
                    "Validation Error",
                    ["Missing season"],
                    "Season is required for TV content"
                )
            );
        }

        if (
            episode === undefined ||
            episode === null ||
            isNaN(Number(episode))
        ) {
            return next(
                new ApiError(
                    400,
                    "Validation Error",
                    ["Missing episode"],
                    "Episode is required for TV content"
                )
            );
        }

        finalSeason = Number(season);
        finalEpisode = Number(episode);
    }

    // -----------------------------
    // Validate uploaded files
    // -----------------------------

    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;

    if (!videoFileLocalPath) {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["No video file was provided"],
                "Please upload a video file and try again"
            )
        );
    }

    const videoThumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoThumbnailLocalPath) {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["No video thumbnail was provided"],
                "Please upload a video thumbnail and try again"
            )
        );
    }

    try {
        // -----------------------------
        // Upload to Cloudinary
        // -----------------------------

        const videoFile = await uploadOnCloudinary(videoFileLocalPath);
        const videoThumbnail = await uploadOnCloudinary(
            videoThumbnailLocalPath
        );

        if (!videoFile || !videoThumbnail) {
            return next(
                new ApiError(
                    500,
                    "Server Error",
                    ["Failed to upload video or thumbnail"],
                    "An error occurred while uploading the video or thumbnail"
                )
            );
        }

        // -----------------------------
        // Create database entry
        // -----------------------------

        const video = await Video.create({
            title: title.trim(),
            description: description.trim(),

            tmdbId: Number(tmdbId),

            type,

            season: finalSeason,
            episode: finalEpisode,

            videoFile: videoFile.url,
            thumbnail: videoThumbnail.url,

            owner: req.user._id,

            duration: videoFile.duration || 0
        });

        // -----------------------------
        // Fetch created video
        // -----------------------------

        const createdVideo = await Video.findById(video._id)
            .populate("owner", "fullName username");

        if (!createdVideo) {
            return next(
                new ApiError(
                    500,
                    "Server Error",
                    ["Error fetching created video"],
                    "An error occurred while retrieving the created video"
                )
            );
        }

        return res.status(201).json(
            new ApiResponse(
                201,
                createdVideo,
                "Video Uploaded Successfully"
            )
        );

    } catch (error) {
        console.error(
            "Error occurred during video upload:",
            error
        );

        return next(
            new ApiError(
                500,
                "Server Error",
                [error.message],
                "An unexpected error occurred while uploading the video"
            )
        );
    }
});


const getVideoById = asyncHandler(async (req, res, next) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid Video ID"],
                "Please check the Video ID and try again"
            )
        );
    }

    const result = await Video.aggregate([
        {
            $match: {
                _id: new Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "liker_list",
                pipeline: [
                    {
                        $project: {
                            likedBy: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner_info",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: {
                    $arrayElemAt: ["$owner_info", 0]
                },

                totalLikes: {
                    $size: "$liker_list"
                },

                likers: "$liker_list"
            }
        },
        {
            $project: {
                owner_info: 0,
                liker_list: 0
            }
        }
    ]);

    const video = result[0];

    if (!video) {
        return next(
            new ApiError(
                404,
                "Video Not Found",
                ["The specified video could not be found"],
                "Please check the video ID and try again"
            )
        );
    }

    const similarVideos = await Video.find({
        _id: {
            $ne: videoId
        },

        title: {
            $regex: new RegExp(
                video.title.split(" ").join("|"),
                "i"
            )
        }
    })
        .select(
            "videoFile thumbnail title views createdAt tmdbId type season episode"
        )
        .populate("owner", "fullName username")
        .limit(5);

    if (req.user) {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $addToSet: {
                    watchHistory: videoId
                }
            }
        );
    }

    await Video.updateOne(
        {
            _id: video._id
        },
        {
            $inc: {
                views: 1
            }
        }
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                video,
                similarVideos
            },
            "Video details fetched successfully"
        )
    );
});


const updateVideo = asyncHandler(async (req, res, next) => {
    const { videoId } = req.params;

    const {
        title,
        description,
        tmdbId,
        type,
        season,
        episode
    } = req.body;

    if (!isValidObjectId(videoId)) {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid Video ID"],
                "Please check the video ID and try again"
            )
        );
    }

    if (title && typeof title !== "string") {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid title format"],
                "Title must be a string"
            )
        );
    }

    if (description && typeof description !== "string") {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid description format"],
                "Description must be a string"
            )
        );
    }

    if (
        tmdbId !== undefined &&
        isNaN(Number(tmdbId))
    ) {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid TMDB ID"],
                "TMDB ID must be a number"
            )
        );
    }

    if (
        type !== undefined &&
        !["movie", "tv"].includes(type)
    ) {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid media type"],
                'Type must be either "movie" or "tv"'
            )
        );
    }

    const video = await Video.findById(videoId)
        .populate("owner", "fullName");

    if (!video) {
        return next(
            new ApiError(
                404,
                "Video Not Found",
                ["The specified video could not be found"],
                "Please check the video ID and try again"
            )
        );
    }

    if (
        video.owner._id.toString() !==
        req.user._id.toString()
    ) {
        return next(
            new ApiError(
                403,
                "Forbidden",
                ["You cannot update this video"],
                "The video you are trying to update does not belong to you"
            )
        );
    }

    // -----------------------------
    // Update metadata
    // -----------------------------

    if (title) {
        video.title = title.trim();
    }

    if (description) {
        video.description = description.trim();
    }

    if (tmdbId !== undefined) {
        video.tmdbId = Number(tmdbId);
    }

    if (type !== undefined) {
        video.type = type;
    }

    if (season !== undefined) {
        video.season =
            season === null || season === ""
                ? null
                : Number(season);
    }

    if (episode !== undefined) {
        video.episode =
            episode === null || episode === ""
                ? null
                : Number(episode);
    }

    // -----------------------------
    // Update thumbnail if provided
    // -----------------------------

    const videoThumbnailLocalPath = req.file?.path;

    if (videoThumbnailLocalPath) {
        const videoThumbnail = await uploadOnCloudinary(
            videoThumbnailLocalPath
        );

        if (!videoThumbnail?.url) {
            return next(
                new ApiError(
                    500,
                    "Server Error",
                    ["Error while uploading the video thumbnail"],
                    "An error occurred during the thumbnail upload"
                )
            );
        }

        video.thumbnail = videoThumbnail.url;
    }

    await video.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            video,
            "Video Details Updated Successfully"
        )
    );
});


const deleteVideo = asyncHandler(async (req, res, next) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        return next(
            new ApiError(
                400,
                "Validation Error",
                ["Invalid Video ID"],
                "Please check the video ID and try again"
            )
        );
    }

    const video = await Video.findById(videoId)
        .populate("owner", "fullName");

    if (!video) {
        return next(
            new ApiError(
                404,
                "Video Not Found",
                ["The specified video could not be found"],
                "Please check the video ID and try again"
            )
        );
    }

    if (
        video.owner._id.toString() !==
        req.user._id.toString()
    ) {
        return next(
            new ApiError(
                403,
                "Forbidden",
                ["You cannot delete this video"],
                "The video you are trying to delete does not belong to you"
            )
        );
    }

    const thumbnailIdOfCloudinary =
        getCloudinaryId(video.thumbnail);

    const videoIdOfCloudinary =
        getCloudinaryId(video.videoFile);

    const [
        thumbnailDeletion,
        videoDeletion
    ] = await Promise.all([
        deleteFromCloudinary(
            thumbnailIdOfCloudinary,
            "image"
        ),

        deleteFromCloudinary(
            videoIdOfCloudinary,
            "video"
        )
    ]);

    if (
        thumbnailDeletion.deleted?.[
            thumbnailIdOfCloudinary
        ] === "not_found" ||

        videoDeletion.deleted?.[
            videoIdOfCloudinary
        ] === "not_found" ||

        thumbnailDeletion.error ||

        videoDeletion.error
    ) {
        return next(
            new ApiError(
                500,
                "Server Error",
                ["Error deleting video from Cloudinary"],
                "An error occurred while deleting the video from Cloudinary"
            )
        );
    }

    await video.deleteOne();

    return res.status(200).json(
        new ApiResponse(
            200,
            null,
            "Video Deleted Successfully"
        )
    );
});


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    return res.status(501).json(
        new ApiResponse(
            501,
            null,
            "Publish status endpoint is not implemented yet"
        )
    );
});


export {
    getAllVideos,
    uploadVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
};
