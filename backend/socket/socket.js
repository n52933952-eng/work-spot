import{Server} from 'socket.io'
import http from 'http'
import express from 'express'

const app = express()

const server = http.createServer(app)

const io = new Server(server,{
    cors:{
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps)
            if (!origin) return callback(null, true);
            
            // Allow localhost and local network IPs
            const allowedOrigins = [
                "http://localhost:5173",
                /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
                /^http:\/\/10\.0\.2\.2:\d+$/, // Android emulator
            ];
            
            const isAllowed = allowedOrigins.some(allowed => {
                if (typeof allowed === 'string') {
                    return origin === allowed;
                } else if (allowed instanceof RegExp) {
                    return allowed.test(origin);
                }
                return false;
            });
            
            // For mobile apps, allow all origins
            callback(null, true);
        },
        methods:["GET","POST"],
        credentials: true
    }
})

export const getRecipientSockedId = (recipientId) => {
    return userSocketMap[recipientId]
}

const userSocketMap = {}

io.on("connection",(socket) => {
    console.log("🔌 User connected", socket.id)
    console.log("📋 Connection query:", socket.handshake.query)
    
    const userId = socket.handshake.query.userId
    if(userId && userId !== "undefined" && userId !== "null") {
      userSocketMap[userId] = socket.id
      // Join socket to user's room for targeted messaging
      socket.join(`user_${userId}`) // Use 'user_' prefix to match emit pattern
      socket.join(userId.toString()) // Also join without prefix for backward compatibility
      console.log(`✅ User ${userId} joined rooms: user_${userId} and ${userId}`)
      console.log(`📊 Total connected users: ${Object.keys(userSocketMap).length}`)
      
      // Log all rooms this socket is in
      const rooms = Array.from(socket.rooms);
      console.log(`📋 Socket ${socket.id} is in rooms:`, rooms);
      
      io.emit("userOnline", userId)
    } else {
      console.log("⚠️ User connected without userId or userId is undefined/null")
      console.log("   Query userId value:", userId)
    }

   
 




    socket.on("disconnect",() => {
        console.log("user disconnected",socket.id)
        // Remove user from map and leave room
        Object.keys(userSocketMap).forEach(key => {
          if (userSocketMap[key] === socket.id) {
            socket.leave(key.toString())
            delete userSocketMap[key]
            io.emit("userOffline", key)
          }
        })
    })
})


export{io,server,app}