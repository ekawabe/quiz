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

function initAnswers(count) {
    teamCount = count;
    answers = {};
    for (let i = 1; i <= count; i++) {
        answers[i] = { team: i, answer: null, isOpen: false, isCorrect: false };
    }
}
initAnswers(teamCount);

io.on('connection', (socket) => {
    socket.emit('update_status', { answers, teamCount, currentFormat });

    socket.on('submit_answer', (data) => {
        const teamId = data.team;
        if (answers[teamId]) {
            // サーバー側でも18文字以内に制限
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
                if (answers[i].isOpen && answers[i].answer === correctChoice) {
                    answers[i].isCorrect = true;
                }
            }
            io.emit('update_status', { answers, teamCount, currentFormat });
        }
    });

    // 次の問題へ（テキストか4択かを選択）
    socket.on('reset', (format) => {
        currentFormat = format;
        for (let i = 1; i <= teamCount; i++) {
            answers[i].answer = null;
            answers[i].isOpen = false;
            answers[i].isCorrect = false;
        }
        io.emit('update_status', { answers, teamCount, currentFormat });
        io.emit('reset_screen', { format: currentFormat, teamCount });
    });

    // めったに使わないチーム数変更（変更時は回答もリセット）
    socket.on('change_team_count', (count) => {
        initAnswers(parseInt(count, 10));
        io.emit('update_status', { answers, teamCount, currentFormat });
        io.emit('reset_screen', { format: currentFormat, teamCount });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});