const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7 // จำกัดขนาดไฟล์อัปโหลดไว้ที่ 10MB
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const activeUsers = new Set();
const chatHistory = [];

io.on('connection', (socket) => {
    let currentUsername = null;

    socket.on('check-username', (username, callback) => {
        const trimmedName = username.trim();
        if (!trimmedName) {
            callback({ success: false, error: 'กรุณากรอกชื่อผู้ใช้' });
        } else if (activeUsers.has(trimmedName)) {
            callback({ success: false, error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });
        } else {
            currentUsername = trimmedName;
            activeUsers.add(currentUsername);
            callback({ success: true });
            
            socket.emit('chat-history', chatHistory);
            io.emit('user-joined', currentUsername);
        }
    });

    socket.on('send-message', (data) => {
        if (!currentUsername) return;

        const messageData = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: currentUsername,
            text: data.text || '',
            file: data.file || null,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        chatHistory.push(messageData);
        if (chatHistory.length > 150) chatHistory.shift();

        io.emit('new-message', messageData);
    });

    socket.on('disconnect', () => {
        if (currentUsername) {
            activeUsers.delete(currentUsername);
            io.emit('user-left', currentUsername);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
