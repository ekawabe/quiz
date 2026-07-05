const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let teamCount = 20;
let currentFormat = 'text'; // 'text' or 'choice'
let baseScore = 10;   // 1問の基本得点
let bonusScore = 10;  // 早押しボーナス得点
let answers = {};
let scores = {};

function initAll(count) {
    teamCount = count;
    answers = {};
    scores = {};
    for (let i = 1; i <= count; i++) {
        answers[i] = { team: i, answer: null, isOpen: false, isCorrect: false, timestamp: null };
        scores[i] = 0;
    }
}
initAll(teamCount);

io.on('connection', (socket) => {
    socket.emit('update_status', { answers, teamCount, currentFormat, scores, baseScore, bonusScore });

    socket.on('submit_answer', (data) => {
        const teamId = data.team;
        if (answers[teamId]) {
            answers[teamId].answer = data.answer.substring(0, 18);
            answers[teamId].timestamp = Date.now(); // 回答した時間を記録
            io.emit('update_status', { answers, teamCount, currentFormat, scores, baseScore, bonusScore });
        }
    });

    socket.on('open_answers', () => {
        for (let i = 1; i <= teamCount; i++) {
            if (answers[i].answer) answers[i].isOpen = true;
        }
        io.emit('update_status', { answers, teamCount, currentFormat, scores, baseScore, bonusScore });
    });

    socket.on('toggle_correct', (teamId) => {
        if (answers[teamId] && answers[teamId].isOpen) {
            answers[teamId].isCorrect = !answers[teamId].isCorrect;
            io.emit('update_status', { answers, teamCount, currentFormat, scores, baseScore, bonusScore });
        }
    });

    socket.on('judge_all_choice', (correctChoice) => {
        if (currentFormat === 'choice') {
            for (let i = 1; i <= teamCount; i++) {
                if (answers[i].isOpen) {
                    answers[i].isCorrect = (answers[i].answer === correctChoice);
                }
            }
            io.emit('update_status', { answers, teamCount, currentFormat, scores, baseScore, bonusScore });
        }
    });

    // 管理画面からの得点設定の更新
    socket.on('update_settings', (data) => {
        if (data.baseScore !== undefined) baseScore = parseInt(data.baseScore, 10);
        if (data.bonusScore !== undefined) bonusScore = parseInt(data.bonusScore, 10);
        io.emit('update_status', { answers, teamCount, currentFormat, scores, baseScore, bonusScore });
    });

    socket.on('reset', (format) => {
        currentFormat = format;

        // 正解者の中で一番早いチームを特定
        let correctTeams = [];
        for (let i = 1; i <= teamCount; i++) {
            if (answers[i].isCorrect && answers[i].timestamp) correctTeams.push(answers[i]);
        }
        correctTeams.sort((a, b) => a.timestamp - b.timestamp);
        let fastestTeamId = correctTeams.length > 0 ? correctTeams[0].team : null;

        // スコア確定
        for (let i = 1; i <= teamCount; i++) {
            if (answers[i].isCorrect) {
                if (i === fastestTeamId) {
                    scores[i] += baseScore + bonusScore; // 一番早いチームにボーナス追加
                } else {
                    scores[i] += baseScore; // その他の正解チーム
                }
            }
            // 回答状態のリセット
            answers[i].answer = null;
            answers[i].isOpen = false;
            answers[i].isCorrect = false;
            answers[i].timestamp = null;
        }
        io.emit('update_status', { answers, teamCount, currentFormat, scores, baseScore, bonusScore });
        io.emit('reset_screen', { format: currentFormat, teamCount });
    });

    socket.on('change_team_count', (count) => {
        initAll(parseInt(count, 10));
        io.emit('update_status', { answers, teamCount, currentFormat, scores, baseScore, bonusScore });
        io.emit('reset_screen', { format: currentFormat, teamCount });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});