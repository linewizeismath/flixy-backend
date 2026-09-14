import { Video } from "../models/video.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const playVideoByTitle = asyncHandler(async (req, res) => {
    const title = String(req.query.title || "").trim();

    if (!title) {
        return res.status(400).json({
            success: false,
            message: "Missing video title"
        });
    }

    const video = await Video.findOne({
        isPublished: true,
        title: {
            $regex: new RegExp(`^${escapeRegex(title)}$`, "i")
        }
    }).select("title videoFile thumbnail duration");

    if (!video) {
        return res.status(404).json({
            success: false,
            message: "Video not found"
        });
    }

    const videoUrl = JSON.stringify(video.videoFile);
    const videoTitle = JSON.stringify(video.title);
    const poster = JSON.stringify(video.thumbnail || "");

    res.status(200).type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${video.title.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]))}</title>
<style>
html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}
body{display:flex;align-items:center;justify-content:center}
video{width:100%;height:100%;background:#000;object-fit:contain}
</style>
</head>
<body>
<video id="player" controls playsinline preload="metadata"${poster !== '""' ? ` poster=${poster}` : ""}>
<source src=${videoUrl} type="video/mp4">
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

export { playVideoByTitle };
