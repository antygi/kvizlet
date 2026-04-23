// Registrace Service Workeru
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('SW registrace selhala: ', err);
        });
    });
}

// 1. ROZCESTNÍK KVÍZŮ
const quizIndex = [
    { id: '2lf-bio', title: 'Modelovky 2LF Biologie', file: 'quizzes/biologie_2lf.json' },
    { id: '2lf-che', title: 'Modelovky 2LF Chemie', file: 'quizzes/chemie_2lf.json' }
    // Sem přidáš další kvízy
];

// 2. STAV APLIKACE A POMOCNÉ FUNKCE
let appState = JSON.parse(localStorage.getItem('quizAppState')) || {};
const loadedQuizzes = {};
let currentQuiz = null;
let currentMode = null; 
let currentQuestionSet = [];
let currentQuestionIndex = 0;
let sessionAnswered = [];

function saveState() {
    localStorage.setItem('quizAppState', JSON.stringify(appState));
}

function initQuizState(quizId) {
    if (!appState[quizId]) {
        appState[quizId] = { progress: 0, failed: [], saved: [], answered: [] };
        saveState();
    }
    if (!appState[quizId].answered) appState[quizId].answered = [];
}

function shuffleArray(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

const appEl = document.getElementById('app');
const headerTitle = document.getElementById('header-title');
const btnHome = document.getElementById('btn-home');

btnHome.addEventListener('click', renderHome);

// 3. NAVIGACE A MENU
function renderHome() {
    currentQuiz = null;
    headerTitle.textContent = 'Dostupné Kvízy';
    btnHome.style.display = 'none';
    appEl.innerHTML = quizIndex.map(q => `
        <div class="card quiz-list-item" onclick="loadAndRenderQuizMenu('${q.id}')">
            <h2>${q.title}</h2>
            <span>Spustit</span>
        </div>
    `).join('');
}

async function loadAndRenderQuizMenu(quizId) {
    appEl.innerHTML = `<div class="card"><p>Načítám...</p></div>`;
    btnHome.style.display = 'block';

    const indexInfo = quizIndex.find(q => q.id === quizId);
    try {
        if (!loadedQuizzes[quizId]) {
            const response = await fetch(indexInfo.file);
            const data = await response.json();
            loadedQuizzes[quizId] = data;
        }
        currentQuiz = loadedQuizzes[quizId];
        initQuizState(quizId);
        const state = appState[quizId];
        headerTitle.textContent = currentQuiz.title;

        appEl.innerHTML = `
            <div class="card">
                <h2>Vyberte režim</h2>
                <div class="menu-item" onclick="startQuiz('all')">
                    <span>Všechny otázky ${state.progress > 0 ? `(od ${state.progress + 1})` : ''}</span>
                </div>
                <div class="menu-item" onclick="startQuiz('unanswered')">
                    <span>Nezodpovězené (${currentQuiz.questions.length - state.answered.length})</span>
                </div>
                <div class="menu-item" onclick="startQuiz('failed')">
                    <span>Nepovedené (${state.failed.length})</span>
                </div>
                <div class="menu-item" onclick="startQuiz('saved')">
                    <span>Uložené (${state.saved.length})</span>
                </div>
            </div>
        `;
    } catch (e) {
        appEl.innerHTML = `<div class="card"><h2>Chyba načítání</h2></div>`;
    }
}

// 4. LOGIKA KVÍZU
function startQuiz(mode) {
    currentMode = mode;
    const state = appState[currentQuiz.id];
    
    // Klíčová změna: Při startu jakéhokoliv režimu zapomeneme "vizuální" odpovědi z minula
    sessionAnswered = []; 

    if (mode === 'all') {
        currentQuestionSet = currentQuiz.questions;
        currentQuestionIndex = state.progress;
    } else if (mode === 'failed') {
        currentQuestionSet = currentQuiz.questions.filter(q => state.failed.includes(q.id));
        currentQuestionIndex = 0;
    } else if (mode === 'saved') {
        currentQuestionSet = currentQuiz.questions.filter(q => state.saved.includes(q.id));
        currentQuestionIndex = 0;
    } else if (mode === 'unanswered') {
        currentQuestionSet = currentQuiz.questions.filter(q => !state.answered.includes(q.id));
        currentQuestionIndex = 0;
    }

    if (currentQuestionSet.length === 0) {
        alert('Žádné otázky v tomto režimu.');
        loadAndRenderQuizMenu(currentQuiz.id);
        return;
    }
    renderQuestion();
}

function renderQuestion() {
    if (currentQuestionIndex >= currentQuestionSet.length) {
        appEl.innerHTML = `<div class="card"><h2>Konec režimu 🎉</h2><button onclick="loadAndRenderQuizMenu('${currentQuiz.id}')">Zpět do menu</button></div>`;
        return;
    }
    if (currentQuestionIndex < 0) currentQuestionIndex = 0;

    const question = currentQuestionSet[currentQuestionIndex];
    const state = appState[currentQuiz.id];
    
    // Změna: isAnswered se nyní dívá pouze na aktuální sezení (sessionAnswered)
    const isAnswered = sessionAnswered.includes(question.id);
    const isSaved = state.saved.includes(question.id);
    
    const shuffledOptions = shuffleArray(question.options);

    const imageHtml = question.image 
        ? `<div class="question-image-container">
            <img src="${question.image}" alt="Otázka ${question.id}" class="question-image">
           </div>` 
        : '';

    appEl.innerHTML = `
        <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <button onclick="loadAndRenderQuizMenu('${currentQuiz.id}')" style="background:#7f8c8d; padding: 5px 10px; font-size: 0.8rem;">← Zpět</button>
                <span style="font-size: 0.9rem; color: #7f8c8d;">${currentQuestionIndex + 1} / ${currentQuestionSet.length}</span>
                <button class="btn-save" id="btn-toggle-save" style="padding: 5px 10px; font-size: 0.8rem;">${isSaved ? '★' : '☆'}</button>
            </div>
            
            <h3>${question.text}</h3>

            ${imageHtml} 
            
            <div class="options-container" id="options">
                ${shuffledOptions.map(opt => `
                    <label class="option-label">
                        <input type="${question.isMulti ? 'checkbox' : 'radio'}" name="answer" 
                               value="${opt.text}" data-correct="${opt.isCorrect}" ${isAnswered ? 'disabled' : ''}>
                        ${opt.text}
                    </label>
                `).join('')}
            </div>

            <div id="feedback-container"></div>
            
            <div class="controls" style="display: flex; justify-content: space-between; gap: 10px;">
                <button id="btn-prev" ${currentQuestionIndex === 0 ? 'disabled' : ''} style="flex:1;">Předchozí</button>
                <button id="btn-submit" style="flex:2; ${isAnswered ? 'display:none' : ''}">Zkontrolovat</button>
                <button id="btn-next" style="flex:1;" ${currentQuestionIndex === currentQuestionSet.length - 1 ? 'disabled' : ''}>Další</button>
            </div>
            <button id="btn-learned" class="btn-success" style="display: none; width: 100%; margin-top: 10px;">Už to umím!</button>
        </div>
    `;

    // Zobrazení výsledků proběhne jen pokud je v sessionAnswered
    if (isAnswered) showResults(question, false);

    document.getElementById('btn-submit')?.addEventListener('click', () => checkAnswer(question));
    document.getElementById('btn-prev').addEventListener('click', () => { currentQuestionIndex--; renderQuestion(); });
    document.getElementById('btn-next').addEventListener('click', () => { currentQuestionIndex++; renderQuestion(); });
    document.getElementById('btn-toggle-save').addEventListener('click', () => toggleSaved(question.id));

    if (currentMode === 'all') {
        state.progress = currentQuestionIndex;
        saveState();
    }
}

function checkAnswer(question) {
    const inputs = document.querySelectorAll('input[name="answer"]');
    if (![...inputs].some(i => i.checked)) {
        alert('Vyber odpověď!');
        return;
    }

    const state = appState[currentQuiz.id];
    
    // Uložíme do globálního seznamu pro "Nezodpovězené"
    if (!state.answered.includes(question.id)) {
        state.answered.push(question.id);
    }
    
    // Uložíme do aktuálního sezení pro vizuální zobrazení
    if (!sessionAnswered.includes(question.id)) {
        sessionAnswered.push(question.id);
    }
    
    saveState();
    showResults(question, true);
}

function showResults(question, isJustChecked) {
    const inputs = document.querySelectorAll('input[name="answer"]');
    let allCorrect = true;

    inputs.forEach(input => {
        const isOptCorrect = input.dataset.correct === 'true';
        const label = input.parentElement;
        
        if (isOptCorrect) label.style.color = 'var(--success)';
        if (input.checked && !isOptCorrect) {
            label.style.color = 'var(--danger)';
            allCorrect = false;
        }
        if (!input.checked && isOptCorrect) allCorrect = false;
        input.disabled = true;
    });

    const feedbackEl = document.getElementById('feedback-container');
    const state = appState[currentQuiz.id];

    if (allCorrect) {
        feedbackEl.innerHTML = `<div class="feedback correct">Správně!</div>`;
        if (currentMode === 'failed') {
            const btn = document.getElementById('btn-learned');
            btn.style.display = 'block';
            btn.onclick = () => {
                state.failed = state.failed.filter(id => id !== question.id);
                saveState();
                currentQuestionIndex >= currentQuestionSet.length - 1 ? loadAndRenderQuizMenu(currentQuiz.id) : (currentQuestionIndex++, renderQuestion());
            };
        }
    } else {
        feedbackEl.innerHTML = `<div class="feedback wrong">Špatně.</div>`;
        if (!state.failed.includes(question.id)) {
            state.failed.push(question.id);
            saveState();
        }
    }
    
    document.getElementById('btn-submit').style.display = 'none';
}

function toggleSaved(questionId) {
    const state = appState[currentQuiz.id];
    const index = state.saved.indexOf(questionId);
    if (index > -1) state.saved.splice(index, 1);
    else state.saved.push(questionId);
    saveState();
    renderQuestion();
}

renderHome();