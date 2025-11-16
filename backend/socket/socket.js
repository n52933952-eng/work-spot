import{Server} from 'socket.io'
import http from 'http'
import express from 'express'

const app = express()

const server = http.createServer(app)

const io = new Server(server,{
    cors:{
        origin:"http://localhost:5173",
        methods:["GET","POST"]
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
      io.emit("userOnline", userId)
    }

   
 




    socket.on("disconnect",() => {
        console.log("user disconnected",socket.id)
        // Remove user from map
        Object.keys(userSocketMap).forEach(key => {
          if (userSocketMap[key] === socket.id) {
            delete userSocketMap[key]
            io.emit("userOffline", key)
          }
        })
    })
})


export{io,server,app}