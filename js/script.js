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
    randomModeEnabled: false,
    currentSubject: null, // New: Tracks which subject is selected
    showLegacy: false, // New: Tracks if legacy subjects are shown
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
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path></svg>
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
        // Saving 'isAnswered' allows resuming on the results of the current question if the user navigates away after answering but before "Next"
        isAnswered: state.isAnswered,
        timerEnabled: state.timerEnabled,
        randomModeEnabled: state.randomModeEnabled,
        currentSubject: state.currentSubject,
        questionOrder: (state.activeQuestions && state.currentSubject && allQuizzes[state.currentSubject]) 
            ? state.activeQuestions.map(q => {
                const subjectData = allQuizzes[state.currentSubject].data;
                return subjectData.indexOf(q);
            }) : []
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
        state.quizEndIndex = data.quizEndIndex;
        state.timerEnabled = data.timerEnabled;
        state.randomModeEnabled = data.randomModeEnabled;
        state.currentSubject = data.currentSubject || null;

        if (typeof allQuizzes !== 'undefined' && state.currentSubject) {
            const subjectData = allQuizzes[state.currentSubject].data;
            if (data.questionOrder && Array.isArray(data.questionOrder) && data.questionOrder.length > 0) {
                // Restore exact order (handles shuffled states)
                state.activeQuestions = data.questionOrder.map(idx => subjectData[idx]).filter(q => q);
            } else {
                // Fallback for legacy saves or missing order
                state.activeQuestions = subjectData.slice(state.quizStartIndex, state.quizEndIndex);
            }
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

function toggleRandomMode() {
    state.randomModeEnabled = !state.randomModeEnabled;
    const btn = document.getElementById('random-toggle-btn');
    if (btn) {
        if (state.randomModeEnabled) {
            btn.classList.remove('bg-slate-800/50', 'hover:bg-slate-800');
            btn.classList.add('bg-indigo-500/10', 'border-indigo-500');
            btn.querySelector('.icon-container').classList.remove('bg-slate-700', 'text-slate-400');
            btn.querySelector('.icon-container').classList.add('bg-indigo-500', 'text-white');
            btn.querySelector('.status-title').classList.remove('text-slate-300');
            btn.querySelector('.status-title').classList.add('text-indigo-400');
            btn.querySelector('.status-text').innerText = 'Activé (Ordre aléatoire)';
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

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getCorrectIndices(question) {
    return question.options
        .map((opt, idx) => opt.isCorrect ? idx : -1)
        .filter(idx => idx !== -1);
}

// Render Functions
function renderStartScreen() {
    if (!state.currentSubject) {
        renderSubjectsScreen();
        return;
    }

    const subject = allQuizzes[state.currentSubject];
    const quizData = subject.data;
    const total = quizData.length;
    const setsCount = 6;
    const setSize = Math.ceil(total / setsCount);

    let setsHtml = '';
    for (let i = 0; i < setsCount; i++) {
        const start = i * setSize + 1;
        const end = Math.min((i + 1) * setSize, total);
        if (start > total) break; 

        setsHtml += `
            <button onclick="startQuiz(${i * setSize}, ${end})" class="group relative px-6 py-4 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg font-semibold text-lg transition-all border border-slate-700 hover:border-indigo-500 flex justify-between items-center group-hover:scale-[1.02]">
                <div class="flex flex-col text-left">
                    <span>Set ${i + 1}</span>
                    <span class="text-xs opacity-60 font-normal">Questions ${start} - ${end}</span>
                </div>
                ${(() => {
                    const best = getBestScore(`${state.currentSubject}_${i * setSize}`, end);
                    return best !== null 
                        ? `<div class="text-right"><span class="block text-xs uppercase tracking-widest text-emerald-400 font-bold">Best</span><span class="text-xl font-bold text-white">${best}</span></div>` 
                        : `<svg class="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
                })()}
            </button>
        `;
    }

    // Add "All" button
    setsHtml += `
        <button onclick="startQuiz(0, ${total})" class="col-span-1 md:col-span-2 lg:col-span-3 mt-2 group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-lg transition-all transform hover:-translate-y-1 w-full shadow-lg shadow-indigo-500/25 flex justify-center items-center">
            <span class="relative">Tout le questionnaire (${total})</span>
            ${(() => {
                const best = getBestScore(`${state.currentSubject}_0`, total);
                return best !== null 
                    ? `<div class="text-right flex flex-col items-end leading-none ml-4"><span class="text-[0.6rem] uppercase tracking-widest text-indigo-200 mb-1">Record</span><span class="text-2xl font-bold">${best}</span></div>` 
                    : '';
            })()}
        </button>
    `;

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
        <div class="glass-card rounded-xl p-8 md:p-12 text-center animate-fade-in mx-auto w-full max-w-5xl">
            <div class="mb-6 flex justify-between items-center">
                <button onclick="selectSubject(null)" class="text-slate-500 hover:text-white transition-colors flex items-center gap-2 group">
                    <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </div>
                    <span class="text-sm font-medium">Retour aux thèmes</span>
                </button>
                <button onclick="toggleMusic()" class="music-toggle-btn text-slate-500 hover:text-white transition-colors flex items-center gap-2 group">
                    <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                    </div>
                    <span class="text-sm font-medium">Son Off</span>
                </button>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight uppercase">
                ${subject.title}
            </h1>
            <p class="text-base text-slate-400 mb-8 leading-relaxed italic">
                "${randomPhrase}"
            </p>
            
            <div class="w-full max-w-4xl mx-auto">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <button id="timer-toggle-btn" onclick="toggleTimerMode()" class="w-full flex items-center justify-between px-6 py-4 rounded-lg border border-slate-700 ${state.timerEnabled ? 'bg-indigo-500/10 border-indigo-500' : 'bg-slate-800/50 hover:bg-slate-800'} transition-all group">
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

                    <button id="random-toggle-btn" onclick="toggleRandomMode()" class="w-full flex items-center justify-between px-6 py-4 rounded-lg border border-slate-700 ${state.randomModeEnabled ? 'bg-indigo-500/10 border-indigo-500' : 'bg-slate-800/50 hover:bg-slate-800'} transition-all group">
                         <div class="flex items-center gap-3">
                            <div class="icon-container w-10 h-10 rounded-lg ${state.randomModeEnabled ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-400'} flex items-center justify-center transition-colors">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                            </div>
                            <div class="text-left">
                                <span class="status-title block font-semibold ${state.randomModeEnabled ? 'text-indigo-400' : 'text-slate-300'}">Mode Aléatoire</span>
                                <span class="status-text text-xs text-slate-500">${state.randomModeEnabled ? 'Activé' : 'Désactivé'}</span>
                            </div>
                         </div>
                         <div class="switch-bg w-12 h-6 rounded-full relative transition-colors ${state.randomModeEnabled ? 'bg-indigo-500' : 'bg-slate-700'}">
                            <div class="switch-knob absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${state.randomModeEnabled ? 'translate-x-6' : ''}"></div>
                         </div>
                    </button>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${setsHtml}
                </div>
            </div>
        </div>
    `;
    updateMusicButtons();
}

function renderSubjectsScreen() {
    const allKeys = Object.keys(allQuizzes);
    const activeKeys = allKeys.filter(id => !allQuizzes[id].legacy);
    const legacyKeys = allKeys.filter(id => allQuizzes[id].legacy);
    
    // Check for saved progress
    const savedState = localStorage.getItem(STORAGE_KEY);
    let resumeHtml = '';
    
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            if (parsed && parsed.currentSubject && allQuizzes[parsed.currentSubject]) {
                const subject = allQuizzes[parsed.currentSubject];
                const qCount = parsed.quizEndIndex - parsed.quizStartIndex;
                resumeHtml = `
                    <button onclick="resumeQuiz()" class="mb-12 group relative px-8 py-6 bg-amber-500 hover:bg-amber-400 text-white rounded-2xl font-bold text-xl transition-all transform hover:-translate-y-1 w-full shadow-xl shadow-amber-500/20 flex justify-between items-center max-w-2xl mx-auto">
                        <span class="flex flex-col text-left">
                            <span class="text-xs uppercase tracking-widest opacity-70 mb-1">Continuer la session</span>
                            <span>${subject.title}</span>
                            <span class="text-sm font-normal opacity-90 mt-1">Question ${parsed.currentQuestionIndex + 1} / ${qCount} • Score: ${parsed.score}</span>
                        </span>
                        <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </div>
                    </button>
                    <div class="flex items-center gap-4 mb-10 max-w-md mx-auto">
                        <div class="h-px bg-slate-800 flex-1"></div>
                        <span class="text-slate-600 text-xs uppercase font-bold tracking-[0.2em]">Ou choisir un nouveau thème</span>
                        <div class="h-px bg-slate-800 flex-1"></div>
                    </div>
                `;
            }
        } catch(e) {}
    }

    const renderCard = (id, isLegacy = false) => {
        const s = allQuizzes[id];
        return `
            <button onclick="selectSubject('${id}')" class="group relative p-8 ${isLegacy ? 'bg-slate-900/30' : 'bg-slate-800/40'} hover:bg-indigo-600/20 border ${isLegacy ? 'border-slate-800' : 'border-slate-700'} hover:border-indigo-500 rounded-3xl transition-all duration-300 text-left flex flex-col h-full hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/10 ${isLegacy ? 'opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0' : ''}">
                ${isLegacy ? '<span class="absolute top-4 right-6 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-800/50 px-2 py-1 rounded">Archive</span>' : ''}
                <div class="w-14 h-14 ${isLegacy ? 'bg-slate-700' : 'bg-indigo-500'} rounded-2xl flex items-center justify-center mb-6 shadow-lg ${isLegacy ? '' : 'shadow-indigo-500/30'} group-hover:scale-110 transition-transform">
                    <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                </div>
                <h3 class="text-2xl font-bold text-white mb-2">${s.title}</h3>
                <p class="text-slate-400 text-sm leading-relaxed mb-6 flex-grow">${s.data.length} questions disponibles.</p>
                <div class="flex items-center text-indigo-400 font-bold text-sm uppercase tracking-wider group-hover:translate-x-2 transition-transform">
                    Commencer
                    <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                </div>
            </button>
        `;
    };

    let subjectsHtml = activeKeys.map(id => renderCard(id)).join('');
    
    let legacyHtml = '';
    if (legacyKeys.length > 0) {
        if (state.showLegacy) {
            legacyHtml = `
                <div class="col-span-1 md:col-span-2 lg:col-span-3 mt-12 mb-6 flex items-center gap-4">
                    <div class="h-px bg-slate-800 flex-1"></div>
                    <h2 class="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Archives</h2>
                    <div class="h-px bg-slate-800 flex-1"></div>
                </div>
                ${legacyKeys.map(id => renderCard(id, true)).join('')}
                <div class="col-span-1 md:col-span-2 lg:col-span-3 mt-8 flex justify-center">
                    <button onclick="toggleLegacy(false)" class="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                         Masquer les archives
                    </button>
                </div>
            `;
        } else {
            legacyHtml = `
                <div class="col-span-1 md:col-span-2 lg:col-span-3 mt-12 flex justify-center">
                    <button onclick="toggleLegacy(true)" class="px-6 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full text-xs font-bold uppercase tracking-widest border border-slate-700 transition-all flex items-center gap-3">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        Voir les anciens thèmes (${legacyKeys.length})
                    </button>
                </div>
            `;
        }
    }

    app.innerHTML = `
        <div class="w-full max-w-6xl mx-auto py-12 px-4 animate-fade-in">
            <header class="text-center mb-16">
                <div class="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold tracking-[0.2em] uppercase mb-6 animate-pulse-slow">
                    Plateforme de révision
                </div>
                <h1 class="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter">
                    VALENTINO<span class="text-indigo-500">.</span>QUIZ
                </h1>
                <p class="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    Préparez vos examens avec nos questionnaires interactifs conçus pour une mémorisation efficace.
                </p>
            </header>

            ${resumeHtml}

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                ${subjectsHtml}
                
                <!-- Placeholder for future subjects (Hidden on mobile) -->
                <div class="hidden md:flex group relative p-8 bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl flex-col items-center justify-center text-center opacity-40">
                    <div class="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                        <svg class="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                    </div>
                    <span class="text-slate-500 font-medium italic text-sm">Nouveaux thèmes bientôt...</span>
                </div>

                ${legacyHtml}
            </div>
            
            <footer class="mt-24 pt-8 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-6">
                <div class="flex items-center gap-4">
                    <button onclick="toggleMusic()" class="music-toggle-btn text-slate-500 hover:text-white transition-colors flex items-center gap-2 group bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
                        <span class="text-xs font-bold uppercase tracking-widest">Musique Off</span>
                    </button>
                </div>
                <p class="text-slate-600 text-xs font-medium tracking-widest uppercase">© 2026 Valentino Quiz • Droit & Formation</p>
            </footer>
        </div>
    `;
    updateMusicButtons();
}

function toggleLegacy(show) {
    state.showLegacy = show;
    renderSubjectsScreen();
}

function selectSubject(subjectId) {
    state.currentSubject = subjectId;
    if (!subjectId) {
        state.activeQuestions = null;
    }
    saveProgress();
    renderStartScreen();
}

function renderQuestion() {
    // Ensure we refer to active questions filtered in startQuiz
    const subject = allQuizzes[state.currentSubject];
    const questionsList = state.activeQuestions || subject.data;

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
                 <div id="timer-bar" class="absolute top-0 left-0 h-full bg-amber-500 transition-all duration-1000 ease-linear" style="width: 100%"></div>
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

    const questionsList = state.activeQuestions || allQuizzes[state.currentSubject].data;
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
    const questionsList = state.activeQuestions || allQuizzes[state.currentSubject].data;
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
    actionBtn.innerText = state.currentQuestionIndex === (state.activeQuestions || allQuizzes[state.currentSubject].data).length - 1 ? 'Voir les résultats' : 'Continuer';
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
    const questionsList = state.activeQuestions || allQuizzes[state.currentSubject].data;
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
    saveBestScore(`${state.currentSubject}_${state.quizStartIndex}`, state.quizEndIndex, state.score);

    const questionsList = state.activeQuestions || allQuizzes[state.currentSubject].data;
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
    `;
    updateMusicButtons();
}

function startQuiz(startIndex = 0, endIndex = null) {
    const subject = allQuizzes[state.currentSubject];
    const quizData = subject.data;

    if (endIndex === null && quizData) {
        endIndex = quizData.length;
    }
    
    // Clear any previous progress when explicitly starting a new quiz
    clearProgress();

    // Slice filtered subset
    state.activeQuestions = quizData.slice(startIndex, endIndex);

    // Shuffle if enabled
    if (state.randomModeEnabled) {
        state.activeQuestions = shuffleArray([...state.activeQuestions]);
    }
    
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
    const userRandomChoice = state.randomModeEnabled;
    if (loadProgress()) {
        state.timerEnabled = userTimerChoice;
        state.randomModeEnabled = userRandomChoice;
        renderQuestion();
    } else {
        startQuiz(); // Fallback
    }
}

// Initial Init
if (typeof allQuizzes !== 'undefined') {
    // Preload timer preference if available
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved) {
        try {
            const parsed = JSON.parse(saved);
            if(parsed.timerEnabled !== undefined) {
                state.timerEnabled = parsed.timerEnabled;
            }
            if(parsed.randomModeEnabled !== undefined) {
                state.randomModeEnabled = parsed.randomModeEnabled;
            }
            // Note: We intentionally don't restore currentSubject here 
            // so the user always starts on the dashboard.
            // The dashboard will show a "Resume" button for the last session.
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
