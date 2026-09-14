import { Router } from 'express';
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    uploadVideo,
    updateVideo,
} from "../controllers/video.controllers.js"
import { playVideoByTitle } from "../controllers/play.controllers.js"
import {verifyJWT} from "../middlewares/auth.middlewares.js"
import {upload} from "../middlewares/multer.middlewares.js"

const router = Router();

// Public playback endpoint for VIXFLIX.
// Example: /api/v1/videos/play?title=Interstellar
router
    .route("/play")
    .get(playVideoByTitle);

// Keep upload and management routes protected.
router.use(verifyJWT);

router
    .route("/")
    .get(getAllVideos)
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1,
            },
            {
                name: "thumbnail",
                maxCount: 1,
            },
        ]),
        uploadVideo
    );

router
    .route("/:videoId")
    .get(getVideoById)
    .delete(deleteVideo)
    .patch(upload.single("thumbnail"), updateVideo);

export default router;