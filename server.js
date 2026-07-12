const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs'); // ดึงระบบจัดการไฟล์ของ Node.js มาช่วยตรวจสอบ

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e7 
});

const PORT = process.env.PORT || 3000;

// ให้บริการไฟล์ทั่วไปจากโฟลเดอร์ public (ถ้ามี)
app.use(express.static(path.join(__dirname, 'public')));

// เส้นทางหลัก: ตรวจสอบและส่งไฟล์ index.html จากสองตำแหน่งที่เป็นไปได้
app.get('/', (req, res) => {
    const publicPath = path.join(__dirname, 'public', 'index.html');
    const rootPath = path.join(__dirname, 'index.html');
    
    if (fs.existsSync(publicPath)) {
        res.sendFile(publicPath);
    } else if (fs.existsSync(rootPath)) {
        res.sendFile(rootPath);
    } else {
        res.status(404).send('<h2>ไม่พบไฟล์ index.html</h2><p>กรุณาตรวจสอบโครงสร้างไฟล์บน GitHub ของคุณ</p>');
    }
});

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
