import "dotenv/config";
import connectDb from "./db/connectDb.js";
import app from "./app.js";

(async () => {
    try {
        connectDb();
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            console.log(`Listening on port -> ${port}`);
        });
    } catch (error) {
        console.log(`MongoDB connection error -> ${error}`);
    }
})();
