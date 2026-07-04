const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// 20チーム分のデータを管理
let answers = {};
function initAnswers() {
    for (let i = 1; i <= 20; i++) {
        answers[i] = { team: i, answer: null, isOpen: false, isCorrect: false };
    }
}
initAnswers();

io.on('connection', (socket) => {
    // 接続した瞬間に現在の状態を送る（途中でリロードしても復帰可能）
    socket.emit('update_status', answers);

    // スマホからの回答を受信
    socket.on('submit_answer', (data) => {
        const teamId = data.team;
        if (answers[teamId]) {
            answers[teamId].answer = data.answer;
            io.emit('update_status', answers); // 全員に同期
        }
    });

    // --- 管理者からの操作 ---

    // 全員の回答をオープン（青背景）
    socket.on('open_answers', () => {
        for (let i = 1; i <= 20; i++) {
            if (answers[i].answer) answers[i].isOpen = true;
        }
        io.emit('update_status', answers);
    });

    // 手動での正誤判定（マスをクリックしたとき）
    socket.on('toggle_correct', (teamId) => {
        if (answers[teamId] && answers[teamId].isOpen) {
            answers[teamId].isCorrect = !answers[teamId].isCorrect; // 赤と青を切り替え
            io.emit('update_status', answers);
        }
    });

    // 次の問題へリセット
    socket.on('reset', () => {
        initAnswers();
        io.emit('update_status', answers);
        io.emit('reset_screen'); // スマホ側の画面もリセット
    });
});

// Renderの環境変数PORTに対応
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});