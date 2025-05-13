// models/userModel.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProfileDetails'
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error(error);
  }
};

const User = mongoose.model('User', userSchema);
export default User;

// models/profileDetailsModel.js
import mongoose from 'mongoose';

const profileDetailsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fullname: {
    type: String,
  },
  username: {
    type: String,
  },
  mobilenumber: {
    type: String,
  },
  bio: {
    type: String,
  },
  gender: {
    type: String,
  },
  dateofbirth: {
    type: String,
  },
  location: {
    type: String,
  },
  profileImg: {
    type: String,
  },
}, { timestamps: true });

const ProfileDetails = mongoose.model('ProfileDetails', profileDetailsSchema);

export default ProfileDetails;

// models/postModel.js
import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  desc: {
    type: String,
  },
  location: {
    type: String,
  },
  postImg: {
    type: String,
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

const Post = mongoose.model('Post', postSchema);

export default Post;

// models/commentModel.js
import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', 
    required: true
  },
  text: {
    type: String,
    required: true
  }
}, { timestamps: true });

const Comment = mongoose.model('Comment', commentSchema);
export default Comment;

// models/followModel.js
import mongoose from 'mongoose';

const followSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

const Follow = mongoose.model('Follow', followSchema);
export default Follow;

// middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_fallback';

export const protect = async (req, res, next) => {
  let token;
  
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      const decoded = jwt.verify(token, JWT_SECRET);
      
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const optionalProtect = async (req, res, next) => {
  let token;
  
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      console.log('Optional auth failed:', error.message);
    }
  }
  
  next();
};

// controllers/userController.js
import User from '../models/userModel.js';
import ProfileDetails from '../models/profileDetailsModel.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_fallback';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '30d' });
};

export const signup = async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        message: existingUser.email === email 
          ? 'Email already in use' 
          : 'Username already taken'
      });
    }
    
    const newUser = new User({ username, email, password });
    await newUser.save();
    
    // Create empty profile for the user
    const newProfile = new ProfileDetails({
      userId: newUser._id,
      username: username
    });
    await newProfile.save();
    
    // Update user with profile reference
    newUser.profileId = newProfile._id;
    await newUser.save();
    
    const token = generateToken(newUser._id);
    
    const userResponse = newUser.toObject();
    delete userResponse.password;
    
    res.status(201).json({
      message: 'User created successfully',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const signin = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ email }).populate('profileId');
    
    if (!user) {
      return res.status(404).json({ message: 'Email not found' });
    }
    
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Incorrect password' });
    }
    
    const token = generateToken(user._id);
    
    const userResponse = user.toObject();
    delete userResponse.password;
    
    return res.status(200).json({
      message: 'Login successful',
      user: userResponse,
      token
    });
  } catch (error) {
    console.error('Signin error:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('profileId')
      .populate('followers', 'username profileId')
      .populate('following', 'username profileId');

    res.status(200).json({
      user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// controllers/profileController.js
import ProfileDetails from '../models/profileDetailsModel.js';
import User from '../models/userModel.js';
import fs from 'fs';
import path from 'path';

export const createProfile = async (req, res) => {
  const {
    fullname,
    username,
    mobilenumber,
    bio,
    gender,
    dateofbirth,
    location,
  } = req.body;

  const profileImg = req.file ? req.file.filename : null;
  const userId = req.user._id;

  try {
    // Check if profile already exists
    const existingProfile = await ProfileDetails.findOne({ userId });
    
    if (existingProfile) {
      return res.status(400).json({ message: 'Profile already exists for this user' });
    }
    
    // Check if username is already taken by another user
    if (username) {
      const usernameExists = await ProfileDetails.findOne({ 
        username, 
        userId: { $ne: userId } 
      });
      
      if (usernameExists) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    const data = {
      userId,
      fullname,
      username,
      mobilenumber,
      bio,
      gender,
      dateofbirth,
      location,
      profileImg,
    };

    const profileInfo = await ProfileDetails.create(data);
    
    // Update user with profile reference
    await User.findByIdAndUpdate(userId, { profileId: profileInfo._id });
    
    res.status(201).json({ 
      message: 'Profile created successfully', 
      data: profileInfo 
    });
  } catch (error) {
    console.error('Error creating profile:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const getProfiles = async (req, res) => {
  try {
    const profiles = await ProfileDetails.find();
    res.status(200).json({ data: profiles });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const getProfileById = async (req, res) => {
  try {
    const profile = await ProfileDetails.findById(req.params.id);
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    res.status(200).json({ data: profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const profile = await ProfileDetails.findOne({ userId: req.user._id });
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    res.status(200).json({ data: profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const updateProfile = async (req, res) => {
  const {
    fullname,
    username,
    mobilenumber,
    bio,
    gender,
    dateofbirth,
    location,
    removeImage
  } = req.body;

  const userId = req.user._id;
  
  try {
    const profile = await ProfileDetails.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Check if username is already taken by another user
    if (username && username !== profile.username) {
      const usernameExists = await ProfileDetails.findOne({ 
        username, 
        userId: { $ne: userId } 
      });
      
      if (usernameExists) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }
    
    const updateData = {};
    
    if (fullname) updateData.fullname = fullname;
    if (username) updateData.username = username;
    if (mobilenumber) updateData.mobilenumber = mobilenumber;
    if (bio) updateData.bio = bio;
    if (gender) updateData.gender = gender;
    if (dateofbirth) updateData.dateofbirth = dateofbirth;
    if (location) updateData.location = location;

    // Handle profile image
    if (req.file) {
      // Remove old image if exists
      if (profile.profileImg) {
        const imagePath = path.join('profile/Images', profile.profileImg);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      updateData.profileImg = req.file.filename;
    } else if (removeImage === 'true') {
      // Remove profile image if requested
      if (profile.profileImg) {
        const imagePath = path.join('profile/Images', profile.profileImg);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      updateData.profileImg = null;
    }

    const updatedProfile = await ProfileDetails.findOneAndUpdate(
      { userId },
      updateData,
      { new: true }
    );

    return res.status(200).json({
      message: 'Profile updated successfully',
      data: updatedProfile
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({
      message: 'Server error', 
      error: error.message
    });
  }
};

export const deleteProfile = async (req, res) => {
  const userId = req.user._id;
  
  try {
    const profile = await ProfileDetails.findOne({ userId });
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Remove profile image if exists
    if (profile.profileImg) {
      const imagePath = path.join('profile/Images', profile.profileImg);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await ProfileDetails.findByIdAndDelete(profile._id);
    
    // Update user to remove profile reference
    await User.findByIdAndUpdate(userId, { profileId: null });
    
    return res.status(200).json({ message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting profile:', error);
    return res.status(500).json({
      message: 'Server error', 
      error: error.message
    });
  }
};

// controllers/postController.js
import Post from '../models/postModel.js';
import User from '../models/userModel.js';
import Comment from '../models/commentModel.js';
import fs from 'fs';
import path from 'path';

export const createPost = async (req, res) => {
  const { desc, location } = req.body;
  const postImg = req.file ? req.file.filename : null;
  const userId = req.user._id;

  try {
    const data = {
      userId,
      desc,
      location,
      postImg,
    };

    const post = await Post.create(data);
    
    const populatedPost = await Post.findById(post._id)
      .populate({
        path: 'userId',
        select: 'username',
        populate: {
          path: 'profileId',
          select: 'profileImg fullname'
        }
      });
    
    res.status(201).json({ 
      message: 'Post created successfully', 
      data: populatedPost 
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const createMultiPost = async (req, res) => {
  const { desc, location } = req.body;
  const userId = req.user._id;
  
  try {
    // Ensure files were uploaded
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded' });
    }
    
    const posts = [];
    
    // Create a post for each uploaded image
    for (const file of req.files) {
      const post = await Post.create({
        userId,
        desc,
        location,
        postImg: file.filename
      });
      
      posts.push(post);
    }
    
    const populatedPosts = await Post.find({ _id: { $in: posts.map(p => p._id) } })
      .populate({
        path: 'userId',
        select: 'username',
        populate: {
          path: 'profileId',
          select: 'profileImg fullname'
        }
      });
    
    res.status(201).json({ 
      message: 'Posts created successfully', 
      data: populatedPosts 
    });
  } catch (error) {
    console.error('Error creating multiple posts:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
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
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate({
        path: 'userId',
        select: 'username',
        populate: {
          path: 'profileId',
          select: 'profileImg fullname'
        }
      });
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    res.status(200).json({ data: post });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const posts = await Post.find({ userId })
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
    console.error('Error fetching user posts:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const getMyPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const posts = await Post.find({ userId })
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
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const updatePost = async (req, res) => {
  const { desc, location } = req.body;
  const postId = req.params.id;
  const userId = req.user._id;
  
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if the user is the owner of the post
    if (post.userId.toString() !== userId.toString()) {
      return res.status(401).json({ message: 'Not authorized to update this post' });
    }
    
    const updateData = {};
    
    if (desc) updateData.desc = desc;
    if (location) updateData.location = location;
    
    // Handle post image
    if (req.file) {
      // Remove old image if exists
      if (post.postImg) {
        const imagePath = path.join('post/Images', post.postImg);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      updateData.postImg = req.file.filename;
    }
    
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      updateData,
      { new: true }
    ).populate({
      path: 'userId',
      select: 'username',
      populate: {
        path: 'profileId',
        select: 'profileImg fullname'
      }
    });
    
    res.status(200).json({ 
      message: 'Post updated successfully', 
      data: updatedPost 
    });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const deletePost = async (req, res) => {
  const postId = req.params.id;
  const userId = req.user._id;
  
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if the user is the owner of the post
    if (post.userId.toString() !== userId.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this post' });
    }
    
    // Remove post image if exists
    if (post.postImg) {
      const imagePath = path.join('post/Images', post.postImg);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Remove all comments associated with the post
    await Comment.deleteMany({ postId });
    
    // Delete the post
    await Post.findByIdAndDelete(postId);
    
    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const likePost = async (req, res) => {
  const postId = req.params.id;
  const userId = req.user._id;
  
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if user has already liked the post
    if (post.likes.includes(userId)) {
      return res.status(400).json({ message: 'Post already liked' });
    }
    
    // Add user to likes array
    post.likes.push(userId);
    await post.save();
    
    res.status(200).json({ 
      message: 'Post liked successfully',
      likesCount: post.likes.length
    });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

export const unlikePost = async (req, res) => {
  const postId = req.params.id;
  const userId = req.user._id;
  
  try {
    const post = await Post.findById(postId);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if user has liked the post
    if (!post.likes.includes(userId)) {
      return res.status(400).json({ message: 'Post not liked yet' });
    }
    
    // Remove user from likes array
    post.likes = post.likes.filter(
      id => id.toString() !== userId.toString()
    );
    await post.save();
    
    res.status(200).json({ 
      message: 'Post unliked successfully',
      likesCount: post.likes.length
    });
  } catch (error) {
    console.error('Error unliking post:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
};

// controllers/commentController.js
import Comment from '../models/commentModel.js';
import Post from '../models/postModel.js';

export const addComment = async (req, res) => {
  const { postId, text } = req.body;
  const userId = req.user._id;
  
  if (!postId || !text) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  try {
    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const newComment = new Comment({
      postId,
      userId,
      text
    });
    
    const savedComment = await newComment.save();
    
    const populatedComment = await Comment.findById(savedComment._id)
      .populate({
        path: 'userId',
        select: 'username',
        populate: {
          path: 'profileId',
          select: 'profileImg fullname'
        }
      });
    
    res.status(201).json({ 
      message: 'Comment added successfully', 
      data: populatedComment 
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getCommentsByPost = async (req, res) => {
  const { postId } = req.params;
  
  try {
    const comments = await Comment.find({ postId })
      .populate({
        path: 'userId',
        select: 'username',
        populate: {
          path: 'profileId',
          select: 'profileImg fullname'
        }
      })
      .sort({ createdAt: -1 });
    
    res.status(200).json({ data: comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const updateComment = async (req, res) => {
  const { commentId } = req.params;
  const { text } = req.body;
  const userId = req.user._id;
  
  try {
    const comment = await Comment.findById(commentId);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if user is the author of the comment
    if (comment.userId.toString() !== userId.toString()) {
      return res.status(401).json({ message: 'Not authorized to update this comment' });
    }
    
    comment.text = text;
    await comment.save();
    
    const updatedComment = await Comment.findById(commentId)
      .populate({
        path: 'userId',
        select: 'username',
        populate: {
          path: 'profileId',
          select: 'profileImg fullname'
        }
      });
    
    res.status(200).json({
      message: 'Comment updated successfully',
      data: updatedComment
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

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
    
    await