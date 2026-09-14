import { app } from "../src/app.js";
import connectDB from "../src/db/index.js";

let dbPromise;

export default async function handler(req, res) {
    try {
        if (!dbPromise) {
            dbPromise = connectDB();
        }

        await dbPromise;
        return app(req, res);
    } catch (error) {
        console.error("Vercel API error:", error);

        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: "Backend failed to initialize",
            });
        }
    }
}
