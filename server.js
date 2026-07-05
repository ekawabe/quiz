const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let teamCount = 20;
let currentFormat = 'text'; // 'text' or 'choice'
let answers = {};
let scores = {}; // チームごとの正解数を保持

// ゲーム初期化（チーム数変更時など）
function initAll(count) {
    teamCount = count;
    answers = {};
    scores = {};
    for (let i = 1; i <= count; i++) {
        answers[i] = { team: i, answer: null, isOpen: false, isCorrect: false };
        scores[i] = 0;
    }
}
initAll(teamCount);

io.on('connection', (socket) => {
    socket.emit('update_status', { answers, teamCount, currentFormat, scores });

    socket.on('submit_answer', (data) => {
        const teamId = data.team;
        if (answers[teamId]) {
            answers[teamId].answer = data.answer.substring(0, 18);
            io.emit('update_status', { answers, teamCount, currentFormat, scores });
        }
    });

    socket.on('open_answers', () => {
        for (let i = 1; i <= teamCount; i++) {
            if (answers[i].answer) answers[i].isOpen = true;
        }
        io.emit('update_status', { answers, teamCount, currentFormat, scores });
    });

    socket.on('toggle_correct', (teamId) => {
        if (answers[teamId] && answers[teamId].isOpen) {
            answers[teamId].isCorrect = !answers[teamId].isCorrect;
            io.emit('update_status', { answers, teamCount, currentFormat, scores });
        }
    });

    socket.on('judge_all_choice', (correctChoice) => {
        if (currentFormat === 'choice') {
            for (let i = 1; i <= teamCount; i++) {
                if (answers[i].isOpen) {
                    answers[i].isCorrect = (answers[i].answer === correctChoice);
                }
            }
            io.emit('update_status', { answers, teamCount, currentFormat, scores });
        }
    });

    // 次の問題へ（ここでスコアを確定させる）
    socket.on('reset', (format) => {
        currentFormat = format;
        for (let i = 1; i <= teamCount; i++) {
            // 赤くなっているチームのスコアを+1
            if (answers[i].isCorrect) {
                scores[i] += 1;
            }
            // 回答状態のリセット
            answers[i].answer = null;
            answers[i].isOpen = false;
            answers[i].isCorrect = false;
        }
        io.emit('update_status', { answers, teamCount, currentFormat, scores });
        io.emit('reset_screen', { format: currentFormat, teamCount });
    });

    // チーム数変更時は全て（スコアも）リセット
    socket.on('change_team_count', (count) => {
        initAll(parseInt(count, 10));
        io.emit('update_status', { answers, teamCount, currentFormat, scores });
        io.emit('reset_screen', { format: currentFormat, teamCount });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});