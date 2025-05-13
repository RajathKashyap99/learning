// Completing the deleteComment function in controllers/commentController.js
export const deleteComment = async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;
  
  try {
    const comment = await Comment.findById(commentId);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if user is the author of the comment
    if (comment.userId.toString() !== userId.toString()) {
      // Also check if user is the owner of the post
      const post = await Post.findById(comment.postId);
      if (!post || post.userId.toString() !== userId.toString()) {
        return res.status(401).json({ message: 'Not authorized to delete this comment' });
      }
    }
    
    await Comment.findByIdAndDelete(commentId);
    
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// controllers/followController.js
import User from '../models/userModel.js';
import Follow from '../models/followModel.js';

export const followUser = async (req, res) => {
  const { targetUserId } = req.params;
  const userId = req.user._id;
  
  try {
    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent self-following
    if (targetUserId === userId.toString()) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }
    
    // Check if already following
    const existingFollow = await Follow.findOne({
      follower: userId,
      following: targetUserId
    });
    
    if (existingFollow) {
      return res.status(400).json({ message: 'Already following this user' });
    }
    
    // Create follow relationship
    const follow = new Follow({
      follower: userId,
      following: targetUserId
    });
    
    await follow.save();
    
    // Update followers and following arrays in User model
    await User.findByIdAndUpdate(userId, {
      $push: { following: targetUserId }
    });
    
    await User.findByIdAndUpdate(targetUserId, {
      $push: { followers: userId }
    });
    
    res.status(200).json({ message: 'User followed successfully' });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const unfollowUser = async (req, res) => {
  const { targetUserId } = req.params;
  const userId = req.user._id;
  
  try {
    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent self-unfollowing
    if (targetUserId === userId.toString()) {
      return res.status(400).json({ message: 'You cannot unfollow yourself' });
    }
    
    // Check if actually following
    const existingFollow = await Follow.findOne({
      follower: userId,
      following: targetUserId
    });
    
    if (!existingFollow) {
      return res.status(400).json({ message: 'Not following this user' });
    }
    
    // Remove follow relationship
    await Follow.findOneAndDelete({
      follower: userId,
      following: targetUserId
    });
    
    // Update followers and following arrays in User model
    await User.findByIdAndUpdate(userId, {
      $pull: { following: targetUserId }
    });
    
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { followers: userId }
    });
    
    res.status(200).json({ message: 'User unfollowed successfully' });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getFollowers = async (req, res) => {
  const { userId } = req.params;
  
  try {
    const user = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'username',
        populate: {
          path: 'profileId',
          select: 'profileImg fullname'
        }
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ data: user.followers });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getFollowing = async (req, res) => {
  const { userId } = req.params;
  
  try {
    const user = await User.findById(userId)
      .populate({
        path: 'following',
        select: 'username',
        populate: {
          path: 'profileId',
          select: 'profileImg fullname'
        }
      });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ data: user.following });
  } catch (error) {
    console.error('Error fetching following users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// controllers/feedController.js
import Post from '../models/postModel.js';
import User from '../models/userModel.js';

export const getFeed = async (req, res) => {
  const userId = req.user._id;
  
  try {
    // Get the list of users that the current user is following
    const user = await User.findById(userId);
    const following = user.following;
    
    // Add the current user to get their posts as well
    following.push(userId);
    
    // Get posts from the current user and the users they are following
    const posts = await Post.find({ userId: { $in: following } })
      .sort({ createdAt: -1 })
      .populate({
        path: 'userId',
        select: 'username',
        populate: {
          path: 'profileId',
          select: 'profileImg fullname'
        }
      });
    
    res.status(200).json({ data: posts });
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getExplore = async (req, res) => {
  const userId = req.user._id;
  const limit = parseInt(req.query.limit) || 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;
  
  try {
    // Get posts that are not from the current user
    const posts = await Post.find({ userId: { $ne: userId } })
      .sort({ createdAt: -1, likes: -1 }) // Sort by recent and popularity
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'userId',
        select: 'username',
        populate: {
          path: 'profileId',
          select: 'profileImg fullname'
        }
      });
    
    const totalPosts = await Post.countDocuments({ userId: { $ne: userId } });
    
    res.status(200).json({ 
      data: posts,
      pagination: {
        totalPosts,
        totalPages: Math.ceil(totalPosts / limit),
        currentPage: page,
        hasNextPage: page < Math.ceil(totalPosts / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching explore feed:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// controllers/searchController.js
import User from '../models/userModel.js';
import ProfileDetails from '../models/profileDetailsModel.js';
import Post from '../models/postModel.js';

export const searchUsers = async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ message: 'Search query is required' });
  }
  
  try {
    // Search for users by username
    const users = await User.find({
      username: { $regex: query, $options: 'i' }
    })
    .select('username profileId')
    .populate('profileId', 'fullname profileImg');
    
    // Also search in profile details
    const profiles = await ProfileDetails.find({
      $or: [
        { fullname: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } }
      ]
    })
    .populate({
      path: 'userId',
      select: 'username'
    });
    
    // Combine results, avoiding duplicates
    const userIds = new Set(users.map(user => user._id.toString()));
    const additionalUsers = [];
    
    for (const profile of profiles) {
      if (!userIds.has(profile.userId._id.toString())) {
        additionalUsers.push({
          _id: profile.userId._id,
          username: profile.userId.username,
          profileId: {
            _id: profile._id,
            fullname: profile.fullname,
            profileImg: profile.profileImg
          }
        });
        userIds.add(profile.userId._id.toString());
      }
    }
    
    const result = [...users, ...additionalUsers];
    
    res.status(200).json({ data: result });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const searchPosts = async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ message: 'Search query is required' });
  }
  
  try {
    // Search for posts by description or location
    const posts = await Post.find({
      $or: [
        { desc: { $regex: query, $options: 'i' } },
        { location: { $regex: query, $options: 'i' } }
      ]
    })
    .sort({ createdAt: -1 })
    .populate({
      path: 'userId',
      select: 'username',
      populate: {
        path: 'profileId',
        select: 'profileImg fullname'
      }
    });
    
    res.status(200).json({ data: posts });
  } catch (error) {
    console.error('Error searching posts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// routes/userRoutes.js
import express from 'express';
import { signup, signin, getMe } from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/signin', signin);
router.get('/me', protect, getMe);

export default router;

// routes/profileRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { 
  createProfile, 
  getProfiles, 
  getProfileById, 
  getMyProfile,
  updateProfile,
  deleteProfile 
} from '../controllers/profileController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for profile image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'profile/Images');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Images only (jpeg, jpg, png, gif)');
    }
  }
});

router.post('/', protect, upload.single('profileImg'), createProfile);
router.get('/', getProfiles);
router.get('/me', protect, getMyProfile);
router.get('/:id', getProfileById);
router.put('/', protect, upload.single('profileImg'), updateProfile);
router.delete('/', protect, deleteProfile);

export default router;

// routes/postRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { 
  createPost,
  createMultiPost,
  getPosts,
  getPostById,
  getUserPosts,
  getMyPosts,
  updatePost,
  deletePost,
  likePost,
  unlikePost
} from '../controllers/postController.js';
import { protect, optionalProtect } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for post image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'post/Images');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Images only (jpeg, jpg, png, gif)');
    }
  }
});

router.post('/', protect, upload.single('postImg'), createPost);
router.post('/multi', protect, upload.array('postImg', 10), createMultiPost);
router.get('/', optionalProtect, getPosts);
router.get('/me', protect, getMyPosts);
router.get('/:id', optionalProtect, getPostById);
router.get('/user/:userId', optionalProtect, getUserPosts);
router.put('/:id', protect, upload.single('postImg'), updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, likePost);
router.post('/:id/unlike', protect, unlikePost);

export default router;

// routes/commentRoutes.js
import express from 'express';
import { 
  addComment, 
  getCommentsByPost, 
  updateComment, 
  deleteComment 
} from '../controllers/commentController.js';
import { protect, optionalProtect } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, addComment);
router.get('/post/:postId', optionalProtect, getCommentsByPost);
router.put('/:commentId', protect, updateComment);
router.delete('/:commentId', protect, deleteComment);

export default router;

// routes/followRoutes.js
import express from 'express';
import { 
  followUser, 
  unfollowUser, 
  getFollowers, 
  getFollowing 
} from '../controllers/followController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/:targetUserId', protect, followUser);
router.delete('/:targetUserId', protect, unfollowUser);
router.get('/:userId/followers', getFollowers);
router.get('/:userId/following', getFollowing);

export default router;

// routes/feedRoutes.js
import express from 'express';
import { getFeed, getExplore } from '../controllers/feedController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getFeed);
router.get('/explore', protect, getExplore);

export default router;

// routes/searchRoutes.js
import express from 'express';
import { searchUsers, searchPosts } from '../controllers/searchController.js';

const router = express.Router();

router.get('/users', searchUsers);
router.get('/posts', searchPosts);

export default router;

// server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import userRoutes from './routes/userRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import postRoutes from './routes/postRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import followRoutes from './routes/followRoutes.js';
import feedRoutes from './routes/feedRoutes.js';
import searchRoutes from './routes/searchRoutes.js';

// Initialize app
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup for ES modules to work with __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static folder setup
app.use('/profile/Images', express.static(path.join(__dirname, 'profile/Images')));
app.use('/post/Images', express.static(path.join(__dirname, 'post/Images')));

// Make sure directories exist
import fs from 'fs';
const dirs = ['profile/Images', 'post/Images'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/search', searchRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Social Media API is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// .env file (example)
// MONGO_URI=mongodb://localhost:27017/social_media_app
// JWT_SECRET=your_jwt_secret_key
// PORT=5000
