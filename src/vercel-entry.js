import dotenv from "dotenv";
import { app } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config();

let dbPromise;

app.use(async (req, res, next) => {
    try {
        if (!dbPromise) {
            dbPromise = connectDB();
        }
        await dbPromise;
        next();
    } catch (error) {
        console.error("Database initialization failed:", error);
        return res.status(500).json({
            success: false,
            message: "Database connection failed",
        });
    }
});

export default app;
