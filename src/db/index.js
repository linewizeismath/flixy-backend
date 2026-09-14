import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

let connectionPromise;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (!connectionPromise) {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI environment variable is missing");
        }

        connectionPromise = mongoose
            .connect(process.env.MONGODB_URI, {
                dbName: DB_NAME,
            })
            .then((connectionInstance) => {
                console.log(
                    `\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`
                );
                return connectionInstance.connection;
            })
            .catch((error) => {
                connectionPromise = undefined;
                console.error("MONGODB connection FAILED", error);
                throw error;
            });
    }

    return connectionPromise;
};

export default connectDB;
