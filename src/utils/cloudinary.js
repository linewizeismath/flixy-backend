import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

console.log("Cloudinary check:", {
    cloud: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY,
    secretLoaded: !!process.env.CLOUDINARY_API_SECRET,
    secretLength: process.env.CLOUDINARY_API_SECRET?.length
});

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });

        fs.unlinkSync(localFilePath);

        return response;

    } catch (error) {
        console.error("CLOUDINARY UPLOAD ERROR:", error);

        if (localFilePath && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        return null;
    }
};

const deleteFromCloudinary = async (contentId, contentType) => {
    try {
        const response = await cloudinary.api.delete_resources([contentId], {
            type: "upload",
            resource_type: contentType,
        });

        return response;

    } catch (error) {
        console.log("🚀 ~ deleteFromCloudinary ~ error:", error);

        throw new Error("Failed to delete content from Cloudinary");
    }
};

const getCloudinaryId = (contentUrl) => {
    if (!contentUrl) return "";

    return contentUrl
        .split("/")
        .pop()
        .replace(/\.[^.]+$/, "");
};

export {
    uploadOnCloudinary,
    deleteFromCloudinary,
    getCloudinaryId
};