import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import profileRouter from "./routes/profileDetRoute.js";
import authRouter from "./routes/user.js";
import postsRouter from "./routes/postDetRoute.js";
import commentRouter from "./routes/commentroute.js";
import followRouter from "./routes/followroute.js";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const **filename = fileURLToPath(import.meta.url);
const **dirname = path.dirname(\_\_filename);

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/post/Images", express.static(path.join(**dirname, "post/Images")));
app.use(
"/profile/Images",
express.static(path.join(**dirname, "profile/Images"))
);

import fs from "fs";
const postImagesDir = path.join(**dirname, "post/Images");
const profileImagesDir = path.join(**dirname, "profile/Images");

if (!fs.existsSync(path.join(**dirname, "post"))) {
fs.mkdirSync(path.join(**dirname, "post"));
}
if (!fs.existsSync(postImagesDir)) {
fs.mkdirSync(postImagesDir);
}
if (!fs.existsSync(path.join(**dirname, "profile"))) {
fs.mkdirSync(path.join(**dirname, "profile"));
}
if (!fs.existsSync(profileImagesDir)) {
fs.mkdirSync(profileImagesDir);
}

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/posts", postsRouter);
app.use("/api/comments", commentRouter);
app.use("/api/social", followRouter);

app.get("/", (req, res) => {
res.send("Social App API is running");
});

app.use((req, res) => {
res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
console.error(err.stack);
res
.status(500)
.json({ message: "Internal Server Error", error: err.message });
});

const MONGODB_URI =
process.env.MONGODB_URI || "mongodb://localhost:27017/socialapp";
const PORT = process.env.PORT || 5000;

mongoose
.connect(MONGODB_URI)
.then(() => {
console.log("Connected to MongoDB");
server.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
})
.catch((err) => {
console.error("MongoDB connection error:", err);
});

export default app;

{
"name": "socialapp_backend",
"version": "1.0.0",
"description": "",
"main": "socialapp.js",
"scripts": {
"test": "echo \"Error: no test specified\" && exit 1",
"start": "nodemon socialapp.js"
},
"author": "",
"license": "ISC",
"dependencies": {
"aws-sdk": "^2.1539.0",
"bcrypt": "^5.1.1",
"bcryptjs": "^2.4.3",
"cors": "^2.8.5",
"dotenv": "^16.4.4",
"express": "^4.18.2",
"jsonwebtoken": "^9.0.2",
"mongoose": "^8.1.3",
"multer": "^1.4.5-lts.1",
"nodemailer": "^6.9.9",
"path": "^0.12.7",
"uuid": "^9.0.1"
},
"type": "module"
}

import { signup, signin, getUserInfo } from "../controllers/user.js";
import express from "express";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/signin", signin);
router.get("/me", protect, getUserInfo);

export default router;

import express from "express";
import multer from "multer";
import path from "path";
import { protect, optionalProtect } from "../middleware/auth.js";

import {
handleProfilePost,
handleProfileGet,
handleProfileUpdate,
handleProfileDelete,
getProfileByUsername,
} from "../controllers/profileDetails.js";

const storage = multer.diskStorage({
destination: function (req, file, cb) {
cb(null, "profile/Images");
},
filename: function (req, file, cb) {
cb(
null,
file.fieldname + "-" + Date.now() + path.extname(file.originalname)
);
},
});

const upload = multer({ storage: storage });

const router = express.Router();

router.post("/", protect, upload.single("profileImage"), handleProfilePost);

router.get("/", optionalProtect, handleProfileGet);

router.get("/username/:username", getProfileByUsername);

router.put("/", protect, upload.single("profileImage"), handleProfileUpdate);

router.delete("/", protect, handleProfileDelete);

export default router;

import express from "express";
import multer from "multer";
import path from "path";
import { protect } from "../middleware/auth.js";

import {
handlePostDet,
handlePostDetGet,
getUserPosts,
handlePostUpdate,
handlePostDelete,
likePost,
} from "../controllers/postDet.js";

const router = express.Router();

// Configure multer for file uploads (now supporting multiple files)
const storage = multer.diskStorage({
destination: function (req, file, cb) {
cb(null, "post/Images");
},
filename: function (req, file, cb) {
cb(
null,
file.fieldname + "-" + Date.now() + path.extname(file.originalname)
);
},
});

const upload = multer({ storage: storage });

// Create a new post (authenticated)
router.post("/", protect, upload.array("postImages", 5), handlePostDet);

// Get all posts
router.get("/", handlePostDetGet);

// Get posts by a specific user
router.get("/user/:userId", getUserPosts);

// Update post (authenticated)
router.put(
"/:postId",
protect,
upload.array("postImages", 5),
handlePostUpdate
);

// Delete post (authenticated)
router.delete("/:postId", protect, handlePostDelete);

// Like/unlike a post (authenticated)
router.post("/:postId/like", protect, likePost);

export default router;
