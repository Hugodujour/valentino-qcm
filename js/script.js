// State
const state = {
    currentQuestionIndex: 0,
    score: 0, // Correct answers
    wrong: 0, // Incorrect answers
    selectedIndices: new Set(),
    isAnswered: false,
    activeQuestions: null,
    // Persistence metadata
    quizStartIndex: 0,
    quizEndIndex: 0,
    timerEnabled: false,
};

// Timer Globals
let timerInterval = null;
const QUESTION_TIME_LIMIT = 30; // seconds

// Storage Key
// Storage Key
const STORAGE_KEY = 'valentino_quiz_state';
const BEST_SCORE_PREFIX = 'valentino_best_';

// Audio
const bgMusic = new Audio('assets/audio/sound.mp3');
bgMusic.loop = true;
let isMusicPlaying = false;

function toggleMusic() {
    if (isMusicPlaying) {
        bgMusic.pause();
    } else {
        bgMusic.play().catch(e => console.log("Audio play failed (user interaction needed first):", e));
    }
    isMusicPlaying = !isMusicPlaying;
    updateMusicButtons();
}

function updateMusicButtons() {
    const btns = document.querySelectorAll('.music-toggle-btn');
    btns.forEach(btn => {
        if (isMusicPlaying) {
            btn.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center hover:bg-indigo-400 transition-colors">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                </div>
                <span class="text-sm font-medium">Son On</span>
            `;
            btn.classList.add('text-indigo-400');
            btn.classList.remove('text-slate-500');
        } else {
            btn.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z clip-path="url(#off)"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path></svg>
                </div>
                <span class="text-sm font-medium">Son Off</span>
            `;
            btn.classList.remove('text-indigo-400');
            btn.classList.add('text-slate-500');
        }
    });
}

function getBestScore(start, end) {
    const val = localStorage.getItem(`${BEST_SCORE_PREFIX}${start}_${end}`);
    return val ? parseInt(val) : null;
}

function saveBestScore(start, end, score) {
    const key = `${BEST_SCORE_PREFIX}${start}_${end}`;
    const current = getBestScore(start, end);
    if (current === null || score > current) {
        localStorage.setItem(key, score);
    }
}

// Persistence Functions
function saveProgress() {
    const data = {
        currentQuestionIndex: state.currentQuestionIndex,
        score: state.score,
        wrong: state.wrong,
        quizStartIndex: state.quizStartIndex,
        quizEndIndex: state.quizEndIndex,
        // We do not save selectedIndices as we assume saving happens between questions or after validation
        // Saving 'isAnswered' allows resuming on the results of the current question if the user navigates away after answering but before "Next"
        // We do not save selectedIndices as we assume saving happens between questions or after validation
        // Saving 'isAnswered' allows resuming on the results of the current question if the user navigates away after answering but before "Next"
        isAnswered: state.isAnswered,
        timerEnabled: state.timerEnabled
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProgress() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    
    try {
        const data = JSON.parse(raw);
        // Restore state
        state.currentQuestionIndex = data.currentQuestionIndex;
        state.score = data.score;
        state.wrong = data.wrong;
        state.quizStartIndex = data.quizStartIndex;
        state.quizEndIndex = data.quizEndIndex;
        state.timerEnabled = data.timerEnabled;
        // Re-slice questions
        if (typeof quizData !== 'undefined') {
            state.activeQuestions = quizData.slice(state.quizStartIndex, state.quizEndIndex);
        }
        
        // If we want to restore strictly the visual state of a validated question, we'd need more logic.
        // For simplicity, we assume resumption starts at the BEGINNING of the saved question index 
        // unless implies otherwise. But user said "revenir au même état".
        // If they were mid-question (not answered), we reset that question.
        // If they answered but didn't click next, we could theoretically show the result.
        // Simplest robust approach: Always start at 'currentQuestionIndex' as a fresh question to answer.
        // The scores are kept.
        state.isAnswered = false; 
        state.selectedIndices.clear();

        return true;
    } catch (e) {
        console.error("Failed to load progress", e);
        return false;
    }
}

function clearProgress() {
    localStorage.removeItem(STORAGE_KEY);
}

// DOM Elements
const app = document.getElementById('app');

// Helpers
function toggleTimerMode() {
    state.timerEnabled = !state.timerEnabled;
    const btn = document.getElementById('timer-toggle-btn');
    if (btn) {
        // Update styling instantly without re-rendering everything
        if (state.timerEnabled) {
            btn.classList.remove('bg-slate-800/50', 'hover:bg-slate-800');
            btn.classList.add('bg-indigo-500/10', 'border-indigo-500');
            btn.querySelector('.icon-container').classList.remove('bg-slate-700', 'text-slate-400');
            btn.querySelector('.icon-container').classList.add('bg-indigo-500', 'text-white');
            btn.querySelector('.status-title').classList.remove('text-slate-300');
            btn.querySelector('.status-title').classList.add('text-indigo-400');
            btn.querySelector('.status-text').innerText = 'Activé (30s / question)';
            btn.querySelector('.switch-bg').classList.remove('bg-slate-700');
            btn.querySelector('.switch-bg').classList.add('bg-indigo-500');
            btn.querySelector('.switch-knob').classList.add('translate-x-6');
        } else {
            btn.classList.remove('bg-indigo-500/10', 'border-indigo-500');
            btn.classList.add('bg-slate-800/50', 'hover:bg-slate-800');
            btn.querySelector('.icon-container').classList.remove('bg-indigo-500', 'text-white');
            btn.querySelector('.icon-container').classList.add('bg-slate-700', 'text-slate-400');
            btn.querySelector('.status-title').classList.remove('text-indigo-400');
            btn.querySelector('.status-title').classList.add('text-slate-300');
            btn.querySelector('.status-text').innerText = 'Désactivé';
            btn.querySelector('.switch-bg').classList.remove('bg-indigo-500');
            btn.querySelector('.switch-bg').classList.add('bg-slate-700');
            btn.querySelector('.switch-knob').classList.remove('translate-x-6');
        }
    } else {
        renderStartScreen();
    }
}

function getCorrectIndices(question) {
    return question.options
        .map((opt, idx) => opt.isCorrect ? idx : -1)
        .filter(idx => idx !== -1);
}

// Render Functions
function renderStartScreen() {
    // Count total questions
    const total = typeof quizData !== 'undefined' ? quizData.length : 0;
    const setsCount = 6;
    const setSize = Math.ceil(total / setsCount);

    let setsHtml = '';
    for (let i = 0; i < setsCount; i++) {
        const start = i * setSize + 1;
        const end = Math.min((i + 1) * setSize, total);
        if (start > total) break; 

        setsHtml += `
            <button onclick="startQuiz(${i * setSize}, ${end})" class="group relative px-6 py-3 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl font-semibold text-lg transition-all border border-slate-700 hover:border-indigo-500 w-full mb-3 flex justify-between items-center group-hover:scale-[1.02]">
                <div class="flex flex-col text-left">
                    <span>Set ${i + 1}</span>
                    <span class="text-xs opacity-60 font-normal">Questions ${start} - ${end}</span>
                </div>
                ${(() => {
                    const best = getBestScore(i * setSize, end);
                    return best !== null 
                        ? `<div class="text-right"><span class="block text-xs uppercase tracking-widest text-emerald-400 font-bold">Best</span><span class="text-xl font-bold text-white">${best}</span></div>` 
                        : `<svg class="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
                })()}
            </button>
        `;
    }

    // Add "All" button
    setsHtml += `
        <button onclick="startQuiz(0, ${total})" class="mt-4 group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1 w-full shadow-lg shadow-indigo-500/25 flex justify-center items-center">
            <span class="relative">Tout le questionnaire (${total})</span>
            ${(() => {
                const best = getBestScore(0, total);
                return best !== null 
                    ? `<div class="text-right flex flex-col items-end leading-none"><span class="text-[0.6rem] uppercase tracking-widest text-indigo-200 mb-1">Meilleur Score</span><span class="text-2xl font-bold">${best}</span></div>` 
                    : '';
            })()}
        </button>
    `;

    // Check for saved progress
    const savedState = localStorage.getItem(STORAGE_KEY);
    let resumeHtml = '';
    
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            // Verify basic integrity
            if (parsed && typeof parsed.currentQuestionIndex === 'number' && typeof parsed.score === 'number') {
                const qCount = parsed.quizEndIndex - parsed.quizStartIndex;
                resumeHtml = `
                    <button onclick="resumeQuiz()" class="mb-6 group relative px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1 w-full shadow-lg shadow-emerald-500/25 flex justify-between items-center">
                        <span class="flex flex-col text-left">
                            <span>Reprendre la progression</span>
                            <span class="text-xs font-normal opacity-80">Question ${parsed.currentQuestionIndex + 1} / ${qCount} • Score: ${parsed.score}</span>
                        </span>
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </button>
                    <div class="flex items-center gap-4 mb-6">
                        <div class="h-px bg-slate-700 flex-1"></div>
                        <span class="text-slate-500 text-sm uppercase font-semibold tracking-wider">Ou nouvelle partie</span>
                        <div class="h-px bg-slate-700 flex-1"></div>
                    </div>
                `;
            }
        } catch(e) {}
    }

    // Random Phrases
const phrases = [
  "Allez inspecteur, montre-nous ce que dit le Code !",
  "Alors Valentin, on apprend en s'amusant ?",
  "Respire… c’est que du droit, pas une garde à vue.",
  "Le Code pénal te regarde. Et il juge.",
  "Indice : la réponse C n’est pas toujours la bonne.",
  "On n’est pas sur BFMTV, ici faut réfléchir.",
  "Même le Code civil croit en toi.",
  "Fais honneur à l’uniforme !",
  "Un QCM par jour, le barreau pour toujours (ou pas).",
  "Pas d’objection ? Alors répond.",
  "Attention, piège juridique en approche !",
  "Le droit n’oublie jamais. Contrairement à toi.",
  "Courage, après ça tu pourras verbaliser en paix.",
  "T’inquiète, personne n’a jamais aimé le droit.",
  "Encore une question et café mérité !",
  "Wallah cette question est vicieuse.",
  "Si tu rates, c’était un contrôle de routine.",
  "On lâche rien, même pas en flagrant délit.",
  "La loi est dure, mais c’est la loi.",
  "Encore une erreur et on sort le rappel à la loi.",
  "Si t’échoues, on dira que c’était un test psychologique.",
  "Ce QCM est plus sévère que ton chef.",
  "Même le suspect aurait mieux répondu."
];

    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

    app.innerHTML = `
        <div class="glass-card rounded-3xl p-8 md:p-12 text-center animate-fade-in mx-auto w-full max-w-2xl">
            <div class="mb-6 flex justify-end">
                 <button onclick="toggleMusic()" class="music-toggle-btn text-slate-500 hover:text-white transition-colors flex items-center gap-2 group">
                    <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                    </div>
                    <span class="text-sm font-medium">Son Off</span>
                </button>
            </div>
            <div class="mb-6 flex justify-center">
                <div class="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center rotate-3">
                    <img src="./assets/images/balance.gif" alt=":O" class="w-full h-full object-cover">
                </div>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
                QCM Droit des Affaires
            </h1>
            <p class="text-base text-slate-400 mb-8 leading-relaxed">
                ${randomPhrase}
            </p>
            
            <div class="grid gap-2 w-full max-w-md mx-auto">
                <button id="timer-toggle-btn" onclick="toggleTimerMode()" class="mb-4 w-full flex items-center justify-between px-6 py-4 rounded-xl border border-slate-700 ${state.timerEnabled ? 'bg-indigo-500/10 border-indigo-500' : 'bg-slate-800/50 hover:bg-slate-800'} transition-all group">
                     <div class="flex items-center gap-3">
                        <div class="icon-container w-10 h-10 rounded-lg ${state.timerEnabled ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'} flex items-center justify-center transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div class="text-left">
                            <span class="status-title block font-semibold ${state.timerEnabled ? 'text-indigo-400' : 'text-slate-300'}">Mode Chronomètre</span>
                            <span class="status-text text-xs text-slate-500">${state.timerEnabled ? 'Activé (30s / question)' : 'Désactivé'}</span>
                        </div>
                     </div>
                     <div class="switch-bg w-12 h-6 rounded-full relative transition-colors ${state.timerEnabled ? 'bg-indigo-500' : 'bg-slate-700'}">
                        <div class="switch-knob absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${state.timerEnabled ? 'translate-x-6' : ''}"></div>
                     </div>
                </button>

                ${resumeHtml}
                ${setsHtml}
            </div>
        </div>
        </div>
    `;
    updateMusicButtons();
}

function renderQuestion() {
    // Ensure we refer to active questions filtered in startQuiz
    const questionsList = state.activeQuestions || quizData;

    if (state.currentQuestionIndex >= questionsList.length) {
        renderResults();
        return;
    }

    state.isAnswered = false;
    state.selectedIndices.clear();

    const q = questionsList[state.currentQuestionIndex];
    const correctIndices = getCorrectIndices(q);

    const progress = ((state.currentQuestionIndex) / questionsList.length) * 100;

    app.innerHTML = `
        <div class="w-full">
            <div class="mb-6 flex justify-between items-center">
                <button onclick="renderStartScreen()" class="text-slate-500 hover:text-white transition-colors flex items-center gap-2 group">
                    <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </div>
                    <span class="text-sm font-medium">Accueil</span>
                </button>
                <button onclick="toggleMusic()" class="music-toggle-btn text-slate-500 hover:text-white transition-colors flex items-center gap-2 group">
                    <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                    </div>
                    <span class="text-sm font-medium">Son Off</span>
                </button>
            </div>

            <!-- Header Status -->
            <div class="flex justify-between items-end mb-4 px-2">
                <div>
                   <span class="text-xs font-bold text-indigo-400 tracking-wider uppercase mb-1 block">Question</span>
                   <span class="text-2xl font-bold text-white leading-none">${state.currentQuestionIndex + 1}<span class="text-lg text-slate-500 font-normal">/${questionsList.length}</span></span>
                   <span class="text-xs text-slate-500 ml-2">(ID: ${q.id})</span>
                </div>
                <div class="text-right flex gap-6">
                    <div class="text-center">
                        <span class="text-xs font-bold text-emerald-400 tracking-wider uppercase mb-1 block">Good</span>
                        <span class="text-2xl font-bold text-emerald-400 leading-none">${state.score}</span>
                    </div>
                    <div class="text-center">
                        <span class="text-xs font-bold text-rose-400 tracking-wider uppercase mb-1 block">Noob</span>
                        <span class="text-2xl font-bold text-rose-400 leading-none">${state.wrong}</span>
                    </div>
                </div>
            </div>

            <!-- Timer Bar -->
            ${state.timerEnabled ? `
            <div class="relative w-full h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
                 <div id="timer-bar" class="absolute top-0 left-0 h-full bg-amber-400 transition-all duration-1000 ease-linear" style="width: 100%"></div>
            </div>
            ` : ''}

            <!-- Progress Bar -->
            <div class="h-2 w-full bg-slate-800 rounded-full mb-8 overflow-hidden">
                <div class="h-full bg-indigo-500 transition-all duration-500 ease-out" style="width: ${progress}%"></div>
            </div>

            <!-- Card -->
            <div class="glass-card rounded-3xl p-6 md:p-10 animate-slide-up">
                <div class="mb-8">

                    <h2 class="text-xl md:text-3xl font-bold text-slate-50 leading-relaxed tracking-tight">
                        ${q.question}
                    </h2>
                </div>

                <div class="space-y-3" id="options-container">
                    ${q.options.map((opt, idx) => `
                        <button onclick="handleOptionClick(${idx})" id="btn-${idx}" 
                            class="option-btn w-full text-left p-4 md:p-5 rounded-xl border border-slate-700 bg-slate-800/40 relative group">
                            <div class="flex items-start">
                                <div id="marker-${idx}" class="flex-shrink-0 w-6 h-6 rounded border-2 border-slate-600 mr-4 mt-0.5 flex items-center justify-center transition-colors">
                                    <div class="w-2.5 h-2.5 bg-white rounded-sm opacity-0 transform scale-50 transition-all duration-200 check-icon"></div>
                                </div>
                                <span class="text-slate-300 group-hover:text-white transition-colors text-lg font-medium leading-relaxed">${opt.text}</span>
                            </div>
                        </button>
                    `).join('')}
                </div>

                <div class="mt-10 flex justify-end">
                    <button id="skip-btn" onclick="skipQuestion()" 
                        class="px-8 py-3 bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed hover:bg-slate-600 text-slate-300 hover:text-white rounded-xl font-semibold transition-all mr-4">
                        Passer
                    </button>
                    <button id="action-btn" onclick="submitAnswer()" disabled 
                        class="px-8 py-3 bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all">
                        Valider
                    </button>
                </div>
            </div>
        </div>
    `;
    updateMusicButtons();
    if(state.timerEnabled && !state.isAnswered) {
        startTimer();
    }
}

function startTimer() {
    stopTimer();
    let timeLeft = QUESTION_TIME_LIMIT;
    const bar = document.getElementById('timer-bar');
    
    // Initial draw
    if(bar) bar.style.width = '100%';
    
    timerInterval = setInterval(() => {
        timeLeft--;
        const percentage = (timeLeft / QUESTION_TIME_LIMIT) * 100;
        
        if (bar) {
            bar.style.width = `${percentage}%`;
            // Color shift
            if (timeLeft <= 10) {
                bar.classList.remove('bg-amber-400');
                bar.classList.add('bg-rose-500');
            }
        }
        
        if (timeLeft <= 0) {
            stopTimer();
            skipQuestion(); // Auto-skip on timeout
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function handleOptionClick(index) {
    if (state.isAnswered) return;

    const questionsList = state.activeQuestions || quizData;
    const q = questionsList[state.currentQuestionIndex];
    const correctIndices = getCorrectIndices(q);

    const btn = document.getElementById(`btn-${index}`);
    const marker = document.getElementById(`marker-${index}`);
    const check = marker.querySelector('.check-icon');



    // Toggle current
    if (state.selectedIndices.has(index)) {
        state.selectedIndices.delete(index);
        // Style removal
        btn.classList.remove('selected', 'border-indigo-500', 'bg-indigo-500/10');
        marker.classList.remove('bg-indigo-500', 'border-indigo-500');
        check.classList.remove('opacity-100', 'scale-100');
        check.classList.add('opacity-0', 'scale-50');
    } else {
        state.selectedIndices.add(index);
        // Style add
        btn.classList.add('selected', 'border-indigo-500', 'bg-indigo-500/10');
        marker.classList.add('bg-indigo-500', 'border-indigo-500');
        check.classList.add('opacity-100', 'scale-100');
        check.classList.remove('opacity-0', 'scale-50');
    }

    // Enable/Disable Submit Button
    const actionBtn = document.getElementById('action-btn');
    const skipBtn = document.getElementById('skip-btn');
    const hasSelection = state.selectedIndices.size > 0;
    
    actionBtn.disabled = !hasSelection;
    if(skipBtn) skipBtn.disabled = hasSelection;
}

function revealAnswers() {
    stopTimer(); // Stop timer when answering
    state.isAnswered = true;
    const questionsList = state.activeQuestions || quizData;
    const q = questionsList[state.currentQuestionIndex];
    const correctIndices = new Set(getCorrectIndices(q));
    const selected = state.selectedIndices;

    // Visual Feedback
    q.options.forEach((opt, idx) => {
        const btn = document.getElementById(`btn-${idx}`);
        const marker = document.getElementById(`marker-${idx}`);

        // If this option is Correct
        if (correctIndices.has(idx)) {
            // Remove conflicting blue/indigo styles first
            btn.classList.remove('selected', 'border-indigo-500', 'bg-indigo-500/10');
            marker.classList.remove('bg-indigo-500', 'border-indigo-500');
            
            // Mark as green
            btn.classList.add('border-emerald-500', 'bg-emerald-500/10');
            // If we selected it, good! If not, we missed it.
            if (selected.has(idx)) {
                 // Correctly selected
                 marker.classList.add('bg-emerald-500', 'border-emerald-500');
            } else {
                 // Missed
                 // Show it was the answer
                 const badge = document.createElement('span');
                 badge.className = "ml-auto text-emerald-400 text-sm font-bold";
                 badge.innerText = "Réponse attendue";
                 btn.querySelector('.flex').appendChild(badge);
            }
        } 
        // If this option is WRONG (and selected)
        else if (selected.has(idx)) {
             btn.classList.remove('selected', 'border-indigo-500', 'bg-indigo-500/10');
             btn.classList.add('border-rose-500', 'bg-rose-500/10');
             marker.classList.remove('bg-indigo-500', 'border-indigo-500');
             marker.classList.add('bg-rose-500', 'border-rose-500');
        }
    });

    // Disable Skip Button
    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) skipBtn.style.display = 'none';

    // Change Button to "Next"
    const actionBtn = document.getElementById('action-btn');
    actionBtn.disabled = false; // Ensure it's enabled if we came from skip
    actionBtn.innerText = state.currentQuestionIndex === questionsList.length - 1 ? 'Voir les résultats' : 'Continuer';
    actionBtn.onclick = nextQuestion;
    
    // Check correctness for button color
    const isCorrect = selected.size === correctIndices.size && [...selected].every(x => correctIndices.has(x));

    actionBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500', 'bg-slate-700', 'hover:bg-slate-600');
    // If skipped (selected is empty but correct is not), it's wrong (red/slate). If correct, green.
    // Logic: if correct -> green. Else -> default slate/grey for "Continue" usually, but here we use red context if wrong?
    // The previous logic was: isCorrect ? emerald : slate.
    actionBtn.classList.add(isCorrect ? 'bg-emerald-600' : 'bg-slate-700', isCorrect ? 'hover:bg-emerald-500' : 'hover:bg-slate-600');
    
    // Save progress after answering (preserves score)
    saveProgress();
}

function skipQuestion() {
    state.wrong++;
    // We do NOT add to selectedIndices, so it remains empty.
    revealAnswers();
}

function submitAnswer() {
    // Check answer
    const questionsList = state.activeQuestions || quizData;
    const q = questionsList[state.currentQuestionIndex];
    const correctIndices = new Set(getCorrectIndices(q));
    const selected = state.selectedIndices;

    // Check strict equality of sets
    const isCorrect = selected.size === correctIndices.size && 
                      [...selected].every(x => correctIndices.has(x));

    if (isCorrect) {
        state.score++;
    } else {
        state.wrong++;
    }

    revealAnswers();
}

function nextQuestion() {
    state.currentQuestionIndex++;
    saveProgress();
    renderQuestion();
}

function renderResults() {
    clearProgress(); // Clear local storage on completion
    // Save best score
    saveBestScore(state.quizStartIndex, state.quizEndIndex, state.score);

    const questionsList = state.activeQuestions || quizData;
    const total = questionsList.length;
    const percentage = Math.round((state.score / total) * 100);
    
    let message, subMessage, colorClass;

    if (percentage === 100) {
        message = "Parfait !";
        subMessage = "Un sans faute absolu. Bravo !";
        colorClass = "text-emerald-400";
    } else if (percentage >= 80) {
        message = "Excellent !";
        subMessage = "Vous maîtrisez très bien le sujet.";
        colorClass = "text-emerald-400";
    } else if (percentage >= 50) {
        message = "Bien joué !";
        subMessage = "Vous avez de bonnes bases.";
        colorClass = "text-amber-400";
    } else {
        message = "Courage !";
        subMessage = "Révisez encore un peu et réessayez.";
        colorClass = "text-rose-400";
    }

    app.innerHTML = `
        <div class="glass-card rounded-3xl p-12 text-center animate-slide-up w-full text-white mx-auto max-w-2xl">
            <h2 class="text-3xl font-bold mb-2">Résultat Final</h2>
            
            <div class="relative w-48 h-48 mx-auto mb-10 flex items-center justify-center mt-10">
                 <svg class="w-full h-full transform -rotate-90 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                     <circle cx="96" cy="96" r="88" stroke="#1e293b" stroke-width="12" fill="transparent" />
                     <circle cx="96" cy="96" r="88" stroke="currentColor" stroke-width="12" fill="transparent" 
                        class="${colorClass}"
                        stroke-dasharray="553" 
                        stroke-dashoffset="${553 - (553 * percentage / 100)}" 
                        stroke-linecap="round"
                     />
                 </svg>
                 <div class="absolute inset-0 flex flex-col items-center justify-center">
                     <span class="text-6xl font-bold">${state.score}</span>
                     <span class="text-sm text-slate-400 uppercase font-semibold">sur ${total}</span>
                 </div>
            </div>
            
            <div class="flex justify-center gap-8 mb-10">
                 <div class="text-center">
                    <span class="text-sm font-bold text-emerald-400 uppercase tracking-wider block mb-1">Correct</span>
                    <span class="text-3xl font-bold text-white">${state.score}</span>
                 </div>
                 <div class="text-center">
                    <span class="text-sm font-bold text-rose-400 uppercase tracking-wider block mb-1">Incorrect</span>
                    <span class="text-3xl font-bold text-white">${state.wrong}</span>
                 </div>
            </div>

            <h3 class="text-4xl font-bold ${colorClass} mb-4">${message}</h3>
            <p class="text-lg text-slate-300 mb-12">${subMessage}</p>

            <button onclick="renderStartScreen()" class="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-all w-full md:w-auto">
                Retour à l'accueil
            </button>
        </div>
        </div>
    `;
    updateMusicButtons();
}

function startQuiz(startIndex = 0, endIndex = null) {
    if (endIndex === null && typeof quizData !== 'undefined') {
        endIndex = quizData.length;
    }
    
    // Clear any previous progress when explicitly starting a new quiz
    clearProgress();

    // Slice filtered subset
    state.activeQuestions = quizData.slice(startIndex, endIndex);
    state.quizStartIndex = startIndex;
    state.quizEndIndex = endIndex;

    state.currentQuestionIndex = 0;
    state.score = 0;
    state.wrong = 0;
    saveProgress(); // Initial save
    renderQuestion();
}

function resumeQuiz() {
    const userTimerChoice = state.timerEnabled;
    if (loadProgress()) {
        state.timerEnabled = userTimerChoice;
        renderQuestion();
    } else {
        startQuiz(); // Fallback
    }
}

// Initial Init
if (typeof quizData !== 'undefined') {
    // Preload timer preference if available
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved) {
        try {
            const parsed = JSON.parse(saved);
            if(parsed.timerEnabled !== undefined) {
                state.timerEnabled = parsed.timerEnabled;
            }
        } catch(e) {}
    }
    renderStartScreen();
} else {
    app.innerHTML = `
        <div class="text-center p-10 bg-rose-500/10 rounded-xl border border-rose-500/50">
            <h3 class="text-xl font-bold text-rose-400 mb-2">Erreur de chargement</h3>
            <p class="text-rose-200">Le fichier de données (data.js) est manquant ou vide.</p>
        </div>
    `;
}
