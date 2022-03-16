const User = require("../models/User");
const Post = require("../models/Post");
const {sendEmail} = require("../middleware/sendEmail")
const crypto = require("crypto");
const cloudinary = require("cloudinary");
//register a user

exports.register = async (req, res)=>{

    try{

        const {name, email, password, avatar} = req.body;
        let user = await User.findOne({email});
        if(user){
            return res.status(400).json({
                success: false,
                message:"user already exists"
            });
        }
        const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
        });

        user =await User.create({name, email, password, avatar:{public_id:myCloud.public_id, url: myCloud.secure_url}});
        const token = await user.generateToken();
        const options = {expires : new Date(Date.now() + 90*24*60*60*1000), httpOnly: true};
        res.status(200).cookie("token", token, options).json({
            success:true,
            user,
            token
        })

    }catch(err){
        res.status(500).json({
            success: false,
            message: err.message
        })
    }

}

//login a user
exports.login = async (req, res)=>{

    try{
        const {email, password} = req.body;
        const user = await User.findOne({ email }).select("+password").populate("posts followers following");
        if(!user){
            return res.status(400).json({
                success:false,
                message:"user does not exist",
            })
        }

        const isMatch = await user.matchPassword(password);
        if(!isMatch){
            return res.status(400).json({
                success:false,
                message:"password is incorrect",
            })
        }
        const token = await user.generateToken();
        const options = {expires : new Date(Date.now() + 90*24*60*60*1000), httpOnly: true};
        res.status(200).cookie("token", token, options).json({
            success:true,
            user,
            token
        })

    }catch(err){
        return res.status(400).json({
            success:false,
            message:err.message,
        })
    }

}

//logout user
exports.logout = async (req, res) => {
    try{
        res.status(200).cookie("token", null, {expires: new Date(Date.now()), httpOnly: true}).json({
            success:true,
            message:"logged out"
        })
    }catch(err){
        res.status(500).json({
            success:false,
            message:err.message
        })
    }
}

//follow a user
exports.followUser = async (req, res, next)=>{
    try{
        const usertofollow = await User.findById(req.params.id);
        const loggedInUser = await User.findById(req.user._id);
        if(!usertofollow){
            res.status(404).json({
                success: false,
                message:"user not found",
            })
        }
        if(loggedInUser.following.includes(req.params.id)){
            const indexOfFollwing = loggedInUser.following.indexOf(req.params.id);
            loggedInUser.following.splice(indexOfFollwing, 1);

            const indexOfFollwer = usertofollow.followers.indexOf(req.user._id);
            usertofollow.followers.splice(indexOfFollwer, 1);

            await loggedInUser.save()
            await usertofollow.save()
            res.status(200).json({
                success:true,
                message:"user unfollowed succesfully"
            })
        }else{
            usertofollow.followers.push(req.user._id);
            loggedInUser.following.push(req.params.id);
    
            await usertofollow.save()
            await loggedInUser.save()
    
            res.status(200).json({
                success:true,
                message:"followed succesfully"
            })  
        }
    }catch(err){
        res.status(500).json({
            success: false,
            message:err.message,
        })
    }
}

//update the password
exports.updatePassword = async (req, res)=>{
    try{
        const user = await User.findById(req.user._id).select("+password");
        const {oldPassword, newPassword} = req.body
        if(!oldPassword || !newPassword){
            res.status(400).json({
                success:false,
                message:"enter oldPassword and newPassword"
            })
        }

        const isMatch = user.matchPassword(oldPassword);
        if(!isMatch){
            res.status(400).json({
                success:false,
                message:"enter the correct password"
            })
        }
        user.password = newPassword;
        await user.save();
        res.status(200).json({
            success:true,
            message:"password updated succesfully"
        })

    }catch(err){
        res.status(500).json({
            success:false,
            message:err.message
        })
    }
}

//update profile user
exports.updateProfile = async (req, res)=>{
    try{

        const user = await User.findById(req.user._id);
        const {name, email, avatar} = req.body
        if(name){
            user.name = name;
        }
        if(email){
            user.email = email;
        }

        if (avatar) {
            await cloudinary.v2.uploader.destroy(user.avatar.public_id);
      
            const myCloud = await cloudinary.v2.uploader.upload(avatar, {
              folder: "avatars",
            });
            user.avatar.public_id = myCloud.public_id;
            user.avatar.url = myCloud.secure_url;
          }

        await user.save();
        res.status(200).json({
            success:true,
            message:"profile updated succesfully"
        })

    }catch(err){
        res.status(500).json({
            success:false,
            message:err.message
        })
    }
}

//delete user profile

exports.deleteMyProfile = async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      const posts = user.posts;
      const followers = user.followers;
      const following = user.following;
      const userId = user._id;
  
      // Removing Avatar from cloudinary
      await cloudinary.v2.uploader.destroy(user.avatar.public_id);
  
      await user.remove();
  
      // Logout user after deleting profile
  
      res.cookie("token", null, {
        expires: new Date(Date.now()),
        httpOnly: true,
      });
  
      // Delete all posts of the user
      for (let i = 0; i < posts.length; i++) {
        const post = await Post.findById(posts[i]);
        await cloudinary.v2.uploader.destroy(post.image.public_id);
        await post.remove();
      }
  
      // Removing User from Followers Following
      for (let i = 0; i < followers.length; i++) {
        const follower = await User.findById(followers[i]);
  
        const index = follower.following.indexOf(userId);
        follower.following.splice(index, 1);
        await follower.save();
      }
  
      // Removing User from Following's Followers
      for (let i = 0; i < following.length; i++) {
        const follows = await User.findById(following[i]);
  
        const index = follows.followers.indexOf(userId);
        follows.followers.splice(index, 1);
        await follows.save();
      }
  
      // removing all comments of the user from all posts
      const allPosts = await Post.find();
  
      for (let i = 0; i < allPosts.length; i++) {
        const post = await Post.findById(allPosts[i]._id);
  
        for (let j = 0; j < post.comments.length; j++) {
          if (post.comments[j].user === userId) {
            post.comments.splice(j, 1);
          }
        }
        await post.save();
      }
      // removing all likes of the user from all posts
  
      for (let i = 0; i < allPosts.length; i++) {
        const post = await Post.findById(allPosts[i]._id);
  
        for (let j = 0; j < post.likes.length; j++) {
          if (post.likes[j] === userId) {
            post.likes.splice(j, 1);
          }
        }
        await post.save();
      }
  
      res.status(200).json({
        success: true,
        message: "Profile Deleted",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
//get user details

exports.myProfile = async (req, res) => {
    try {
      const user = await User.findById(req.user._id).populate(
        "posts followers following"
      );;
  
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
  
exports.getUserProfile = async (req, res) => {
    try {
      const user = await User.findById(req.params.id).populate(
        "posts followers following"
      );
  
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
  
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
};
//all user info

exports.getAllUsers = async (req, res) => {
    try {
      const users = await User.find({
        name: { $regex: req.query.name, $options: "i" },
      });
  
      res.status(200).json({
        success: true,
        users,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
  
//forgot Password

exports.forgotPassword = async (req, res)=>{
    try{

        const user = await User.findOne({email:req.body.email});
        if(!user){
            return res.status(500).json({
                success:false,
                message:"user not found"
            })
        }

        const resetPasswordToken = await user.getPasswordToken();

        await user.save();

        const resetUrl = `${req.protocol}://${req.get("host")}/password/reset/${resetPasswordToken}`;

        const message = `reset your password by clicking on the link below: \n\n ${resetUrl} `;

        try{
            await sendEmail({
                email:user.email,
                subject:"reset password",
                message,
            })
            res.status(200).json({
                success:true,
                message:`message send to ${user.email}`
            })

        }catch(err){
           user.resetPasswordToken = undefined
           user.resetPasswordExpire = undefined
           await user.save();
           res.status(500).json({
               success:false,
               message:err.message
           })
        }

    }catch(err){
        res.status(500).json({
            success:false,
            message:err.message
        })
    }

}

exports.resetPassword = async (req, res) => {
    try {
        console.log(req.params.token);
      const resetPasswordToken = crypto
        .createHash("sha256")
        .update(req.params.token)
        .digest("hex");
  
      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
      });
  
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Token is invalid or has expired",
        });
      }
  
      user.password = req.body.password;
  
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
  
      res.status(200).json({
        success: true,
        message: "Password Updated",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

exports.getMyPosts = async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
  
      const posts = [];
  
      for (let i = 0; i < user.posts.length; i++) {
        const post = await Post.findById(user.posts[i]).populate(
          "likes comments.user owner"
        );
        posts.push(post);
      }
  
      res.status(200).json({
        success: true,
        posts,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
  
  exports.getUserPosts = async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
  
      const posts = [];
  
      for (let i = 0; i < user.posts.length; i++) {
        const post = await Post.findById(user.posts[i]).populate(
          "likes comments.user owner"
        );
        posts.push(post);
      }
  
      res.status(200).json({
        success: true,
        posts,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };