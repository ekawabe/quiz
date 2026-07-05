const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let teamCount = 20;
let currentFormat = 'text';
let answers = {};

// 初期化（scoreプロパティを追加）
function initAnswers(count) {
    teamCount = count;
    answers = {};
    for (let i = 1; i <= count; i++) {
        answers[i] = { team: i, answer: null, isOpen: false, isCorrect: false, score: 0 };
    }
}
initAnswers(teamCount);

io.on('connection', (socket) => {
    socket.emit('update_status', { answers, teamCount, currentFormat });

    socket.on('submit_answer', (data) => {
        const teamId = data.team;
        if (answers[teamId]) {
            answers[teamId].answer = data.answer.substring(0, 18);
            io.emit('update_status', { answers, teamCount, currentFormat });
        }
    });

    socket.on('open_answers', () => {
        for (let i = 1; i <= teamCount; i++) {
            if (answers[i].answer) answers[i].isOpen = true;
        }
        io.emit('update_status', { answers, teamCount, currentFormat });
    });

    socket.on('toggle_correct', (teamId) => {
        if (answers[teamId] && answers[teamId].isOpen) {
            answers[teamId].isCorrect = !answers[teamId].isCorrect;
            io.emit('update_status', { answers, teamCount, currentFormat });
        }
    });

    socket.on('judge_all_choice', (correctChoice) => {
        if (currentFormat === 'choice') {
            for (let i = 1; i <= teamCount; i++) {
                if (answers[i].isOpen) {
                    answers[i].isCorrect = (answers[i].answer === correctChoice);
                }
            }
            io.emit('update_status', { answers, teamCount, currentFormat });
        }
    });

    socket.on('reset', (format) => {
        currentFormat = format;
        for (let i = 1; i <= teamCount; i++) {
            // 次の問題に行く直前、正解(赤)になっていたチームにスコアを+1する
            if (answers[i].isCorrect) {
                answers[i].score += 1;
            }
            answers[i].answer = null;
            answers[i].isOpen = false;
            answers[i].isCorrect = false;
        }
        io.emit('update_status', { answers, teamCount, currentFormat });
        io.emit('reset_screen', { format: currentFormat, teamCount });
    });

    socket.on('change_team_count', (count) => {
        initAnswers(parseInt(count, 10));
        io.emit('update_status', { answers, teamCount, currentFormat });
        io.emit('reset_screen', { format: currentFormat, teamCount });
    });

    // スコアのみを全リセットする機能（設定画面用）
    socket.on('reset_scores', () => {
        for (let i = 1; i <= teamCount; i++) {
            answers[i].score = 0;
            answers[i].isCorrect = false; // 現在の赤判定も解除
        }
        io.emit('update_status', { answers, teamCount, currentFormat });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});