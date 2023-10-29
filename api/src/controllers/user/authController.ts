import bcrypt from "bcryptjs";
import { User } from "../../models/User";
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
import { Request, Response } from "express";
import loginHelper from "../../helpers/loginHelper"
import { Error } from "mongoose";
dotenv.config();

const authController  = {
    handleLogin: async (req: Request, res: Response) => {
        //getting secrets from .env
        const accessSecret = process.env.ACCESS_TOKEN_SECRET;
        const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
        //extracting user's data from request
        const {emailOrUsername, password} = req.body;
        //find user in db
        const checker = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        const user = await loginHelper(emailOrUsername, checker)
        //return error if user not found
        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }
        //password verification
        try {
            const result = await bcrypt.compare(password, user.password);
            if (result) {
                // Passwords match (Authentication successful)
                //tokens
                const accessToken = jwt.sign(
                    {_id: user._id, email: user.email, username: user.username},
                    accessSecret,
                    { expiresIn: "1h" },
                );
                const refreshToken = jwt.sign(
                    { _id: user._id,  email: user.email, username: user.username}, 
                    refreshSecret, 
                    { expiresIn: "7d" }
                );
                //save refresh token into database
                user.refreshToken = refreshToken;
                await user.save();
                //response
                res.cookie('refreshToken', refreshToken, { 
                    httpOnly: true, 
                    maxAge: 7 * 24 * 60 * 60 * 1000 
                }); 
                res.json({ 
                    message: 'Login successful', 
                    accessToken,
                    user: {
                        _id: user._id,
                        email: user.email,
                        username: user.username
                    } 
                });
            } else {
                // Passwords do not match (Unauthorized)
                res.status(401).json({ message: 'Invalid credentials' });
            }
        } catch (err: any) {
            // Internal server error
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    handleLogout: async (req: Request, res: Response) => {
        //get cookies from request
        const cookies = req.cookies;
        //if refreshToken doesn't exist in cookies send status code 204 (because user is not logged in)
        if (!cookies.refreshToken) res.sendStatus(204);
        //otherwise find user with refreshToken and set it to empty
        const user = await User.findOne({ refreshToken: cookies.refreshToken})
        //if user exists set his token to empty in db
        if(user){
            user.refreshToken = "";
            await user.save();
        }
        //clear token in cookies
        res.clearCookie("refreshToken", { httpOnly: true });
        res.sendStatus(204);
    },

    handleRegister: async (req: Request, res: Response) => {
        //getting secrets from .env
        const jwtSecret = process.env.ACCESS_TOKEN_SECRET;
        const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
        //extracting user's data from request
        const {email, password, username} = req.body;

        try {
            //recording new user in database
            const encryptedPass = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
            const user = await User.create({
                email: email,
                password: encryptedPass,
                username: email
            })
            //creating tokens
            const accessToken = jwt.sign({ _id: user._id,  email: email, username: email}, jwtSecret, {expiresIn: '1h'})
            const refreshToken = jwt.sign({ _id: user._id,  email: email, username: email}, refreshSecret, { expiresIn: "7d" });
            //response
            res.cookie('refreshToken', refreshToken, { 
                httpOnly: true, 
                maxAge: 7 * 24 * 60 * 60 * 1000 
            }); 
            res.json({ message: 'Login successful', accessToken });
        } catch (err: any){
            if(err instanceof Error.ValidationError){
                res.status(400).json({ message: 'Validation failed', details: err.errors});
            }
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    handleRefreshToken: async (req: Request, res: Response) => {
        //get cookies
        const cookies = req.cookies;
        //secrets
        const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
        const accessSecret = process.env.ACCESS_TOKEN_SECRET;
        //return status 401 if no refreshToken in cookies
        if (!cookies?.refreshToken) res.sendStatus(401);
        //write down refreshToken
        const refreshToken = cookies.refreshToken
        //find user, if no user send error status code 404
        const user = await User.findOne({ refreshToken });
        if (!user) res.sendStatus(404);
        //verify refreshToken
        jwt.verify(
            refreshToken,
            refreshSecret,
            (err: any, decodedUser: any) => {
                if (err) res.sendStatus(403); //handle error
                //create access token and send response
                const accessToken = jwt.sign(
                    { _id: decodedUser._id, username: decodedUser.username },
                    accessSecret,
                    { expiresIn: "1h" },
                );
                res.json({
                    accessToken,
                    user: {
                        _id: user._id,
                        email: user.email,
                        username: user.username
                    }
                });
            }
        )
    }

}

export default authController;