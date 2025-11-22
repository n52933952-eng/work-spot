import jwt from 'jsonwebtoken'


const GenerateToken = (userId,res) => {

    const token = jwt.sign({userId},process.env.JWT_SCRET,{expiresIn:"5d"})

    const cookieOptions = {
        httpOnly:true,
        maxAge:15 * 24 * 60 * 1000,
        sameSite:"lax", // Changed from "strict" to allow cross-origin on localhost
        secure: process.env.NODE_ENV === 'production' // Only secure in production
    };

    console.log('🍪 [GenerateToken] Creating cookie with options:', cookieOptions);
    console.log('🔑 [GenerateToken] Token for userId:', userId);

    res.cookie("jwt",token, cookieOptions)


    return token 
}

export default GenerateToken