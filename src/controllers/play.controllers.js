import { Video } from "../models/video.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const escapeHtml = (value) => {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
};

const playVideo = asyncHandler(async (req, res) => {
    const tmdbId = getNumber(req.query.tmdbId);
    const type = String(req.query.type || "").trim().toLowerCase();
    const season = getNumber(req.query.season);
    const episode = getNumber(req.query.episode);

    if (!tmdbId) {
        return res.status(400).send("Missing or invalid TMDB ID");
    }

    if (type !== "movie" && type !== "tv") {
        return res.status(400).send("Invalid media type");
    }

    if (type === "tv" && (season === null || episode === null)) {
        return res.status(400).send("Season and episode are required");
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

    const video = await Video.findOne(query).select(
        "title videoFile thumbnail duration"
    );

    if (!video) {
        return res.status(404).send("Matching Flixy video was not found");
    }

    const videoUrl = String(video.videoFile || "")
        .replace(/^http:\/\//i, "https://");

    const thumbnailUrl = String(video.thumbnail || "")
        .replace(/^http:\/\//i, "https://");

    if (!videoUrl) {
        return res.status(404).send("Flixy video URL is missing");
    }

    const title = escapeHtml(video.title);
    const safeVideoUrl = escapeHtml(videoUrl);
    const safeThumbnailUrl = escapeHtml(thumbnailUrl);

    res.status(200).type("html").send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${title}</title>

<style>
html,
body {
    margin: 0;
    width: 100%;
    height: 100%;
    background: #000;
    overflow: hidden;
}

body {
    display: flex;
    align-items: center;
    justify-content: center;
}

video {
    width: 100%;
    height: 100%;
    background: #000;
    object-fit: contain;
}

#error {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    padding: 10px 12px;
    background: rgba(180, 0, 0, 0.92);
    color: #fff;
    font-family: Arial, sans-serif;
    font-size: 13px;
    border-radius: 4px;
    display: none;
    word-break: break-word;
}
</style>
</head>

<body>

<video
    id="player"
    controls
    playsinline
    preload="metadata"
    ${safeThumbnailUrl ? `poster="${safeThumbnailUrl}"` : ""}
>
    <source
        src="${safeVideoUrl}"
        type="video/mp4"
    >
</video>

<div id="error"></div>

<script>
const player = document.getElementById("player");
const errorBox = document.getElementById("error");

player.addEventListener("loadedmetadata", () => {
    console.log("Flixy video metadata loaded.");
});

player.addEventListener("canplay", () => {
    console.log("Flixy video can play.");
});

player.addEventListener("error", () => {
    const error = player.error;

    let message = "Video failed to load.";

    if (error) {
        message += " MediaError code: " + error.code;
    }

    console.error("FLIXY VIDEO ERROR:", error);

    errorBox.textContent = message;
    errorBox.style.display = "block";
});

player.load();
</script>

</body>
</html>
`);
});

export { playVideo };
