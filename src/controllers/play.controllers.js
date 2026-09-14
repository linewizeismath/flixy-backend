import { Video } from "../models/video.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getNumberOrNull = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const playVideo = asyncHandler(async (req, res) => {
    const title = String(req.query.title || "").trim();
    const tmdbId = getNumberOrNull(req.query.tmdbId);
    const type = String(req.query.type || "").trim().toLowerCase();
    const season = getNumberOrNull(req.query.season);
    const episode = getNumberOrNull(req.query.episode);

    if (!tmdbId) {
        return res.status(400).json({
            success: false,
            message: "Missing or invalid TMDB ID"
        });
    }

    if (!["movie", "tv"].includes(type)) {
        return res.status(400).json({
            success: false,
            message: 'Type must be "movie" or "tv"'
        });
    }

    if (type === "tv" && (!season || !episode)) {
        return res.status(400).json({
            success: false,
            message: "Season and episode are required for TV content"
        });
    }

    const query = {
        isPublished: true,
        tmdbId,
        type
    };

    if (type === "tv") {
        query.season = season;
        query.episode = episode;
    } else {
        query.season = null;
        query.episode = null;
    }

    // Title is optional as an extra safety check.
    // TMDB ID + type + season + episode are the real identifiers.
    if (title) {
        query.title = {
            $regex: new RegExp(`^${escapeRegex(title)}$`, "i")
        };
    }

    const video = await Video.findOne(query)
        .select("title videoFile thumbnail duration tmdbId type season episode");

    if (!video) {
        return res.status(404).json({
            success: false,
            message: "Matching Flixy video was not found"
        });
    }

    const videoUrl = JSON.stringify(video.videoFile);
    const videoTitle = JSON.stringify(video.title);
    const poster = JSON.stringify(video.thumbnail || "");

    const safeTitle = video.title.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[character]));

    const episodeLabel =
        video.type === "tv"
            ? `S${String(video.season).padStart(2, "0")}E${String(video.episode).padStart(2, "0")}`
            : "";

    const pageTitle = episodeLabel
        ? `${safeTitle} - ${episodeLabel}`
        : safeTitle;

    res.status(200).type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<style>
html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}
body{display:flex;align-items:center;justify-content:center}
video{width:100%;height:100%;background:#000;object-fit:contain}
</style>
</head>
<body>
<video id="player" controls playsinline preload="metadata"${poster !== '""' ? ` poster=${poster}` : ""}>
<source src=${videoUrl}>
Your browser does not support HTML5 video.
</video>
<script>
const player=document.getElementById("player");
player.autoplay=true;
player.play().catch(()=>{});
</script>
</body>
</html>`);
});

export { playVideo };
