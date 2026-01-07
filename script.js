// State
const state = {
    currentQuestionIndex: 0,
    score: 0, // Correct answers
    wrong: 0, // Incorrect answers
    selectedIndices: new Set(),
    isAnswered: false,
    activeQuestions: null,
};

// DOM Elements
const app = document.getElementById('app');

// Helpers
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
                <span>Set ${i + 1}</span>
                <span class="text-sm opacity-60 font-normal">Questions ${start} - ${end}</span>
            </button>
        `;
    }

    // Add "All" button
    setsHtml += `
        <button onclick="startQuiz(0, ${total})" class="mt-4 group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg transition-all transform hover:-translate-y-1 w-full shadow-lg shadow-indigo-500/25">
            <span class="relative">Tout le questionnaire (${total})</span>
        </button>
    `;

    // Random Phrases
    const phrases = [
"Alors Valentin, on apprend en s'amusant ?",
"Well well well, tu es revenu finalement !",
"Oh shit, encore toi ? Bon beh c'est parti…",
"T'as le droit de continuer (par rapport au droit…)",
"Aller on y va, on lâche rien bg !",
"Y'a-t-il un flic pour sauver la ville ?",
"Le droit c'est pas compliqué: Il a dit Wallah !",
"Et zé repartiiii !",
"Eh bah, force à toi man !",
"Même ma grand mère fait mieux !"

    ];
    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

    app.innerHTML = `
        <div class="glass-card rounded-3xl p-8 md:p-12 text-center animate-fade-in mx-auto w-full max-w-2xl">
            <div class="mb-6 flex justify-center">
                <div class="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center rotate-3">
                    <svg class="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                </div>
            </div>
            <h1 class="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
                QCM Droit des Affaires
            </h1>
            <p class="text-base text-slate-400 mb-8 leading-relaxed">
                ${randomPhrase}
            </p>
            
            <div class="grid gap-2 w-full max-w-md mx-auto">
                ${setsHtml}
            </div>
        </div>
    `;
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
    const isMultiple = correctIndices.length > 1;
    const progress = ((state.currentQuestionIndex) / questionsList.length) * 100;

    app.innerHTML = `
        <div class="w-full">
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

            <!-- Progress Bar -->
            <div class="h-2 w-full bg-slate-800 rounded-full mb-8 overflow-hidden">
                <div class="h-full bg-indigo-500 transition-all duration-500 ease-out" style="width: ${progress}%"></div>
            </div>

            <!-- Card -->
            <div class="glass-card rounded-3xl p-6 md:p-10 animate-slide-up">
                <div class="mb-8">
                    ${isMultiple ? 
                        `<span class="inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full mb-4">
                            Plusieurs réponses possibles
                        </span>` : ''}
                    <h2 class="text-xl md:text-2xl font-medium text-slate-100 leading-relaxed font-sans">
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
                                <span class="text-slate-300 group-hover:text-white transition-colors text-lg">${opt.text}</span>
                            </div>
                        </button>
                    `).join('')}
                </div>

                <div class="mt-10 flex justify-end">
                    <button id="action-btn" onclick="submitAnswer()" disabled 
                        class="px-8 py-3 bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all">
                        Valider
                    </button>
                </div>
            </div>
        </div>
    `;
}

function handleOptionClick(index) {
    if (state.isAnswered) return;

    const questionsList = state.activeQuestions || quizData;
    const q = questionsList[state.currentQuestionIndex];
    const correctIndices = getCorrectIndices(q);
    const isMultiple = correctIndices.length > 1;
    const btn = document.getElementById(`btn-${index}`);
    const marker = document.getElementById(`marker-${index}`);
    const check = marker.querySelector('.check-icon');

    // Logic: if not multiple, clear other selections
    if (!isMultiple) {
        // Deselect others
        state.selectedIndices.forEach(idx => {
            if (idx !== index) {
                const b = document.getElementById(`btn-${idx}`);
                const m = document.getElementById(`marker-${idx}`);
                const c = m.querySelector('.check-icon');
                if (b) {
                   b.classList.remove('selected', 'border-indigo-500', 'bg-indigo-500/10');
                   m.classList.remove('bg-indigo-500', 'border-indigo-500');
                   c.classList.remove('opacity-100', 'scale-100');
                   c.classList.add('opacity-0', 'scale-50');
                }
            }
        });
        state.selectedIndices.clear();
    }

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
    actionBtn.disabled = state.selectedIndices.size === 0;
}

function submitAnswer() {
    state.isAnswered = true;
    
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

    // Change Button to "Next"
    const actionBtn = document.getElementById('action-btn');
    actionBtn.innerText = state.currentQuestionIndex === questionsList.length - 1 ? 'Voir les résultats' : 'Continuer';
    actionBtn.onclick = nextQuestion;
    actionBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-500');
    actionBtn.classList.add(isCorrect ? 'bg-emerald-600' : 'bg-slate-700', isCorrect ? 'hover:bg-emerald-500' : 'hover:bg-slate-600');
}

function nextQuestion() {
    state.currentQuestionIndex++;
    renderQuestion();
}

function renderResults() {
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
    `;
}

function startQuiz(startIndex = 0, endIndex = null) {
    if (endIndex === null && typeof quizData !== 'undefined') {
        endIndex = quizData.length;
    }
    
    // Slice filtered subset
    state.activeQuestions = quizData.slice(startIndex, endIndex);

    state.currentQuestionIndex = 0;
    state.score = 0;
    state.wrong = 0;
    renderQuestion();
}

// Initial Init
if (typeof quizData !== 'undefined') {
    renderStartScreen();
} else {
    app.innerHTML = `
        <div class="text-center p-10 bg-rose-500/10 rounded-xl border border-rose-500/50">
            <h3 class="text-xl font-bold text-rose-400 mb-2">Erreur de chargement</h3>
            <p class="text-rose-200">Le fichier de données (data.js) est manquant ou vide.</p>
        </div>
    `;
}
