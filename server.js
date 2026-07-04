const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let teamCount = 20; // デフォルトのチーム数
let currentFormat = 'text'; // 'text' (フリー) or 'choice' (4択)
let answers = {};

function initAnswers(count) {
    teamCount = count;
    answers = {};
    for (let i = 1; i <= count; i++) {
        answers[i] = { team: i, answer: null, isOpen: false, isCorrect: false };
    }
}
initAnswers(teamCount);

io.on('connection', (socket) => {
    // 接続時に現在の全情報を送る
    socket.emit('update_status', { answers, teamCount, currentFormat });

    // 回答を受信
    socket.on('submit_answer', (data) => {
        const teamId = data.team;
        if (answers[teamId]) {
            answers[teamId].answer = data.answer;
            io.emit('update_status', { answers, teamCount, currentFormat });
        }
    });

    // 全オープン（青）
    socket.on('open_answers', () => {
        for (let i = 1; i <= teamCount; i++) {
            if (answers[i].answer) answers[i].isOpen = true;
        }
        io.emit('update_status', { answers, teamCount, currentFormat });
    });

    // 手動での正誤判定（個別クリック）
    socket.on('toggle_correct', (teamId) => {
        if (answers[teamId] && answers[teamId].isOpen) {
            answers[teamId].isCorrect = !answers[teamId].isCorrect;
            io.emit('update_status', { answers, teamCount, currentFormat });
        }
    });

    // 4択一括での正解判定（赤）
    socket.on('judge_all_choice', (correctChoice) => {
        if (currentFormat === 'choice') {
            for (let i = 1; i <= teamCount; i++) {
                // オープン済み、かつ回答が一致していれば赤にする
                if (answers[i].isOpen && answers[i].answer === correctChoice) {
                    answers[i].isCorrect = true;
                }
            }
            io.emit('update_status', { answers, teamCount, currentFormat });
        }
    });

    // 次の問題へ（チーム数、形式の変更含む）
    socket.on('reset', (data) => {
        currentFormat = data.format || 'text';
        if (data.teamCount) teamCount = parseInt(data.teamCount, 10);

        initAnswers(teamCount);

        // サーバーとスマホ画面の両方をリセット
        io.emit('update_status', { answers, teamCount, currentFormat });
        io.emit('reset_screen', { format: currentFormat, teamCount });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});