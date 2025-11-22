import User from '../modles/User.js'
import jwt from 'jsonwebtoken'
const protectRoute = async(req,res,next) => {


    try{
        console.log('🔐 [protectRoute] Checking authentication for:', req.method, req.url);
        console.log('🍪 [protectRoute] Cookies received:', req.cookies);
        console.log('📋 [protectRoute] Headers:', req.headers);
        
        // Check for token in cookies (for web) or Authorization header (for mobile)
        let token = req.cookies.jwt;
        
        // If no cookie token, check Authorization header (Bearer token)
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7); // Remove "Bearer " prefix
                console.log('🔑 [protectRoute] Token found in Authorization header');
            }
        } else {
            console.log('🔑 [protectRoute] Token found in cookies');
        }
        
        if(!token){
            console.log('❌ [protectRoute] No token found - returning 401');
            return res.status(401).json({message:"no token"})
        }
 
        const decode = jwt.verify(token,process.env.JWT_SCRET)
        console.log('✅ [protectRoute] Token verified, userId:', decode.userId);
      
         const user = await User.findById(decode.userId).select("-password")
         console.log('✅ [protectRoute] User found:', user?.email || user?.employeeNumber);

         req.user = user

         next()
    }
    catch(error){
        console.log('❌ [protectRoute] Error:', error.message);
        res.status(500).json(error)
    }
}


export default protectRoute