import { Video } from "../models/video.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const playVideo = asyncHandler(async (req, res) => {
    const tmdbId = getNumber(req.query.tmdbId);
    const type = String(req.query.type || "").trim().toLowerCase();
    const season = getNumber(req.query.season);
    const episode = getNumber(req.query.episode);

    if (!tmdbId) {
        return res.status(400).json({
            success: false,
            message: "Missing or invalid TMDB ID"
        });
    }

    if (type !== "movie" && type !== "tv") {
        return res.status(400).json({
            success: false,
            message: "Type must be movie or tv"
        });
    }

    const query = {
        isPublished: true,
        tmdbId,
        type
    };

    if (type === "tv") {
        if (season === null || episode === null) {
            return res.status(400).json({
                success: false,
                message: "Season and episode are required for TV content"
            });
        }

        query.season = season;
        query.episode = episode;
    } else {
        query.season = null;
        query.episode = null;
    }

    const video = await Video.findOne(query).select(
        "title videoFile thumbnail duration tmdbId type season episode"
    );

    if (!video) {
        return res.status(404).json({
            success: false,
            message: "Matching Flixy video was not found"
        });
    }

    return res.status(200).json({
        success: true,
        data: {
            title: video.title,
            videoFile: video.videoFile,
            thumbnail: video.thumbnail,
            duration: video.duration,
            tmdbId: video.tmdbId,
            type: video.type,
            season: video.season,
            episode: video.episode
        }
    });
});

export { playVideo };
