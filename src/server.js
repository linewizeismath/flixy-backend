import dotenv from "dotenv";
import { app } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config();

connectDB()
    .then(() => {
        app.on("error", (error) => {
            console.error("Express error:", error);
            throw error;
        });

        app.listen(process.env.PORT || 8000, () => {
            console.log(`Server is running at port ${process.env.PORT || 8000}`);
        });
    })
    .catch((error) => {
        console.error("MONGO db connection failed !!!", error);
        process.exit(1);
    });
