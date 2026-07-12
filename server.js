const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7 // จำกัดขนาดไฟล์ที่ส่งผ่าน Socket ไว้ที่ 10MB
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// เก็บข้อมูลใน Memory
const activeUsers = new Set();
const chatHistory = [];

io.on('connection', (socket) => {
    let currentUsername = null;

    // ตรวจสอบและลงทะเบียนชื่อผู้ใช้
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
            
            // ส่งประวัติการคุยให้ผู้ใช้ใหม่เห็น
            socket.emit('chat-history', chatHistory);
            
            // แจ้งเตือนทุกคนว่ามีคนเข้าร่วมแชท
            io.emit('user-joined', currentUsername);
        }
    });

    // รับและกระจายข้อความแชทกลุ่ม
    socket.on('send-message', (data) => {
        if (!currentUsername) return;

        const messageData = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            sender: currentUsername,
            text: data.text || '',
            file: data.file || null, // { name: string, type: string, data: base64 }
            timestamp: new Date().toLocaleTimeString()
        };

        chatHistory.push(messageData);
        // จำกัดประวัติการแชทไว้ที่ 100 ข้อความล่าสุดเพื่อประหยัด Memory
        if (chatHistory.length > 100) chatHistory.shift();

        io.emit('new-message', messageData);
    });

    // ตัดการเชื่อมต่อ
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
