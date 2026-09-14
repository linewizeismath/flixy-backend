import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoFile: {
            type: String, // Cloudinary URL
            required: true
        },

        thumbnail: {
            type: String, // Cloudinary URL
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true
        },

        // TMDB movie/show ID
        tmdbId: {
            type: Number,
            required: true
        },

        // Either "movie" or "tv"
        type: {
            type: String,
            enum: ["movie", "tv"],
            required: true
        },

        // Used for TV/anime episodes
        season: {
            type: Number,
            default: null
        },

        episode: {
            type: Number,
            default: null
        },

        duration: {
            type: Number,
            required: true
        },

        views: {
            type: Number,
            default: 0
        },

        isPublished: {
            type: Boolean,
            default: true
        },

        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
);

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);
