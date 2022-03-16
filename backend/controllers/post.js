const Post = require("../models/Post");
const User = require("../models/User");
const cloudinary = require("cloudinary");

//create a post
exports.createPost = async (req, res) => {
    try {
      const myCloud = await cloudinary.v2.uploader.upload(req.body.image, {
        folder: "posts",
      });
      const newPostData = {
        caption: req.body.caption,
        image: {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        },
        owner: req.user._id,
      };
  
      const post = await Post.create(newPostData);
  
      const user = await User.findById(req.user._id);
  
      user.posts.unshift(post._id);
  
      await user.save();
      res.status(201).json({
        success: true,
        message: "Post created",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
};
  

//delete post
exports.deletePost = async (req, res, next)=>{
    try{
        const post = await Post.findById(req.params.id);
        if(!post){
            res.status(404).json({
                success: false,
                message:"post not found"
            })
        }
        if(post.owner.toString() !== req.user._id.toString()){
            res.status(401).json({
                success:false,
                message: "unauthorized"
            })
        }
        await cloudinary.v2.uploader.destroy(post.image.public_id);
        const user = await User.findById(req.user._id);
        const index = user.posts.indexOf(req.params.id);
        user.posts.splice(index, 1);
        await user.save();
        await post.remove();
        res.status(200).json({
            success:true,
            message: "post deleted"
        })
    }catch (err){
        res.status(500).json({
            success:false,
            message: err.message,
        })
    }
}

//like and dislike a post
exports.likeAndUnlikePost = async (req, res, next)=>{
    try{
        const post = await Post.findById(req.params.id);
        if(!post){
            res.status(404).json({
                success: false,
                message:"post not found"
            })
        }
        if(post.likes.includes(req.user._id)){
            const index = post.likes.indexOf(req.user._id);
            post.likes.splice(index, 1);
            await post.save();
            return res.status(200).json({
                success: true,
                message: "post unliked",
            })
        }

        post.likes.push(req.user._id);
        await post.save();
        return res.status(200).json({
            success: true,
            message: "post liked",
        })
    }catch(err){
         res.status(500).json({
            success: true,
            message: err.message,
        })
    }
}

//get posts of the user in following array;
exports.getPostOfFollowing = async (req, res, next)=>{
    try{

        const user = await User.findById(req.user._id);
        const posts = await Post.find({
            owner:{
                $in: user.following
            }
        }).populate("owner likes comments.user");
        res.status(200).json({
            success:true,
            posts:posts.reverse()
        })

    }catch(err){
        res.status(500).json({
            success: false,
            message:err.message
        })
    }
}

//update caption
exports.updateCaption = async (req, res)=>{
    try{

        const post = await Post.findById(req.params.id);
        if(!post){
            res.status(500).json({
                success:false,
                message:"post not found"
            })
        }

        if(post.owner.toString() !== req.user._id.toString()){
            res.status(500).json({
                success:false,
                message:"unauthorized"
            })
        }
        post.caption = req.body.caption
        await post.save();
        res.status(200).json({
            success:true,
            message:"post updated"
        })

    }catch(err){
        res.status(500).json({
            success: false,
            message:err.message
        })
    }
}

//add comments;
exports.commentOnPost = async (req, res)=>{
    try{
        const post = await Post.findById(req.params.id);
        if(!post){
            res.status(400).json({
                success:false,
                message:"post not found"
            })
        }
        let commentExist = -1;
        post.comments.forEach((item, index)=>{
            if(item.user.toString() === req.user._id.toString()){
                commentExist = index;
            }
        })

        if(commentExist !== -1){
            post.comments[commentExist].comment = req.body.comment
            await post.save();
            res.status(200).json({
                success:true,
                message:"comment updated"
            })
        }else{
            post.comments.push({
                user:req.user._id,
                comment:req.body.comment
            })
            await post.save();
            res.status(200).json({
                success:true,
                message:"comment added"
            })
        }

    }catch(err){
        res.status(500).json({
            success: false,
            message:err.message
        })
    }
}

exports.deleteComment = async (req, res)=>{
    try{
        const post = await Post.findById(req.params.id);
        if(!post){
            res.status(400).json({
                success:false,
                message:"post not found"
            })
        }

        if(post.owner.toString() === req.user._id.toString()){//it is my post;
            
            if(req.body.commentId==undefined){
                return res.status(200).json({
                    success:true,
                    message:"comment id is required"
                })
            }
            let commentFound = false;
            post.comments.forEach((item, index)=>{
                if(item._id.toString() === req.body.commentId.toString()){
                    commentFound = true;
                    return post.comments.splice(index, 1);
                }
            })  
            if(!commentFound){
                return res.status(500).json({
                    success:false,
                    message:"comment id is not found"
                })
            }
            await post.save();
            return res.status(200).json({
                success:true,
                message:"your selected comment has deleted"
            })
        }else{//someone elses post
            post.comments.forEach((item, index)=>{
                if(item.user.toString() === req.user._id.toString()){
                    return post.comments.splice(index, 1);
                }
            })
            await post.save();
            return res.status(200).json({
                success:true,
                message:"your comment has deleted"
            })
        }

    }catch(err){
        res.status(500).json({
            success: false,
            message:err.message
        })
    }
}