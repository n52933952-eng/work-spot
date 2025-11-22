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
    console.log("user connected",socket.id)
    
    const userId = socket.handshake.query.userId
    if(userId && userId !== "undefined") {
      userSocketMap[userId] = socket.id
      // Join socket to user's room for targeted messaging
      socket.join(userId.toString())
      console.log(`✅ User ${userId} joined room: ${userId}`)
      io.emit("userOnline", userId)
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