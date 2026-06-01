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
    { id: '2lf-che', title: 'Modelovky 2LF Chemie', file: 'quizzes/chemie_2lf.json' },
    { id: '2lf-fyz', title: 'Modelovky 2LF Fyzika', file: 'quizzes/fyzika_2lf.json' },
];

// 2. STAV APLIKACE A POMOCNÉ FUNKCE
let appState = JSON.parse(localStorage.getItem('quizAppState')) || {};
let quizHistory = JSON.parse(localStorage.getItem('quizAppHistory')) || [];
const loadedQuizzes = {};
let currentQuiz = null;
let currentMode = null;
let currentQuestionSet = [];
let currentQuestionIndex = 0;
let sessionAnswered = [];
let testSession = null;

function saveState() {
    localStorage.setItem('quizAppState', JSON.stringify(appState));
}

function saveHistory() {
    localStorage.setItem('quizAppHistory', JSON.stringify(quizHistory));
}

function findIncompleteTest() {
    return quizHistory.find(entry => !entry.isSubmitted) || null;
}

function createHistoryChart(entry) {
    const total = entry.total || 1;
    const correct = entry.correctCount || 0;
    const answered = Object.keys(entry.answers || {}).length;
    const wrong = Math.max(0, answered - correct);
    const unanswered = Math.max(0, total - answered);

    const correctDeg = (correct / total) * 360;
    const wrongDeg = (wrong / total) * 360;
    const unfilledDeg = 360 - correctDeg - wrongDeg;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const textClass = percent >= 75 ? 'green-percent' : '';

    const gradient = `conic-gradient(var(--success) 0deg ${correctDeg}deg, var(--danger) ${correctDeg}deg ${correctDeg + wrongDeg}deg, #bdc3c7 ${correctDeg + wrongDeg}deg 360deg)`;

    return `
        <div class="history-chart" style="background:${gradient}">
            <div class="history-chart-text ${textClass}">${percent}%</div>
        </div>
    `;
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

function generateId() {
    return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const appEl = document.getElementById('app');
const headerTitle = document.getElementById('header-title');
const btnHome = document.getElementById('btn-home');
const btnHistory = document.getElementById('btn-history');

btnHome.addEventListener('click', () => {
    if (currentMode === 'test') {
        exitTest();
    } else {
        renderHome();
    }
});

btnHistory.addEventListener('click', () => {
    renderHistory();
});

function renderHome() {
    currentQuiz = null;
    currentMode = null;
    currentQuestionSet = [];
    currentQuestionIndex = 0;
    sessionAnswered = [];
    testSession = null;
    headerTitle.textContent = 'Moje Kvízy';
    btnHome.style.display = 'none';

    const pending = findIncompleteTest();
    const pendingButton = pending
        ? `<button class="btn-main create" onclick="continueTest('${pending.id}')">Pokračovat v testu</button>`
        : '';

    appEl.innerHTML = `
        <div class="corner-actions">
            <button class="btn-main history" onclick="renderHistory()">Historie testů</button>
        </div>
        <div class="card">
            <h2>Dostupné kvízy</h2>
            ${quizIndex.map(q => `
                <div class="quiz-list-item" onclick="loadAndRenderQuizMenu('${q.id}')">
                    <h2>${q.title}</h2>
                    <span>Spustit</span>
                </div>
            `).join('')}
        </div>
        <div class="card main-actions-card">
            <h2>Hlavní menu</h2>
            <div class="menu-actions">
                ${pendingButton}
                <button class="btn-main create" onclick="renderTestCreator()">Vytvořit test</button>
            </div>
        </div>
    `;
}

async function loadQuizData(quizId) {
    if (!loadedQuizzes[quizId]) {
        const indexInfo = quizIndex.find(q => q.id === quizId);
        const response = await fetch(indexInfo.file);
        const data = await response.json();
        loadedQuizzes[quizId] = data;
    }
    return loadedQuizzes[quizId];
}

async function loadAndRenderQuizMenu(quizId) {
    appEl.innerHTML = `<div class="card"><p>Načítám...</p></div>`;
    btnHome.style.display = 'block';

    try {
        currentQuiz = await loadQuizData(quizId);
        initQuizState(quizId);
        const state = appState[quizId];
        headerTitle.textContent = currentQuiz.title;
        currentMode = 'quizMenu';

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

function renderHistory() {
    currentQuiz = null;
    currentMode = 'history';
    currentQuestionSet = [];
    currentQuestionIndex = 0;
    sessionAnswered = [];
    testSession = null;
    headerTitle.textContent = 'Historie testů';
    btnHome.style.display = 'block';

    if (!quizHistory.length) {
        appEl.innerHTML = `
            <div class="card">
                <h2>Historie testů</h2>
                <p>Zatím žádné testy.</p>
            </div>
        `;
        return;
    }

    appEl.innerHTML = `
        <div class="card">
            <h2>Historie testů</h2>
            ${quizHistory.map(entry => {
                const chartHtml = entry.isSubmitted ? createHistoryChart(entry) : '';
                const statusHtml = entry.isSubmitted
                    ? chartHtml
                    : `<span class="history-status incomplete">Nedokončený</span>`;
                const continueButton = !entry.isSubmitted ? `<button onclick="continueTest('${entry.id}')">Pokračovat</button>` : '';

                return `
                    <div class="history-card">
                        ${statusHtml}
                        <div>
                            <strong>${entry.quizTitles.join(', ')}</strong>
                            <p>${new Date(entry.createdAt).toLocaleString('cs-CZ')}</p>
                        </div>
                        <div>
                            ${continueButton}
                            <button onclick="renderHistoryDetail('${entry.id}')">Zobrazit</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderHistoryDetail(entryId) {
    const entry = quizHistory.find(item => item.id === entryId);
    if (!entry) {
        alert('Test nenalezen.');
        return;
    }

    currentQuiz = null;
    currentMode = 'historyDetail';
    currentQuestionSet = [];
    currentQuestionIndex = 0;
    sessionAnswered = [];
    testSession = null;
    headerTitle.textContent = 'Detail testu';
    btnHome.style.display = 'block';

    const resultSummary = entry.isSubmitted
        ? `<div class="test-summary"><strong>Výsledek:</strong> ${entry.correctCount} / ${entry.total} správně</div>`
        : `<div class="test-summary"><strong>Stav:</strong> test nebyl odevzdán (${Object.keys(entry.answers).length} odpovědí z ${entry.total})</div>`;

    appEl.innerHTML = `
        <div class="card">
            <h2>Detail testu</h2>
            <p><strong>Vybrané kvízy:</strong> ${entry.quizTitles.join(', ')}</p>
            <p><strong>Datum:</strong> ${new Date(entry.createdAt).toLocaleString('cs-CZ')}</p>
            ${resultSummary}
        </div>
        ${entry.questionSet.map((question, index) => {
            const answer = entry.answers[question.id] || [];
            const correctOptions = question.options.filter(opt => opt.isCorrect).map(opt => opt.text);
            return `
                <div class="card history-question-card">
                    <h3>${index + 1}. ${question.text}</h3>
                    <p class="history-source">Zdroj: ${question._quizTitle}</p>
                    <div class="options-container">
                        ${question.options.map(opt => {
                            const selected = answer.includes(opt.text);
                            const classes = [];
                            if (opt.isCorrect) classes.push('correct');
                            if (selected && !opt.isCorrect) classes.push('wrong');
                            return `
                                <label class="option-label history-option ${classes.join(' ')}">
                                    <input type="checkbox" disabled ${selected ? 'checked' : ''}>
                                    ${opt.text}
                                </label>
                            `;
                        }).join('')}
                    </div>
                    ${entry.isSubmitted ? `<p><strong>Správná odpověď:</strong> ${correctOptions.join(', ') || 'Žádná'}</p>` : ''}
                </div>
            `;
        }).join('')}
    `;
}

function renderTestCreator() {
    currentQuiz = null;
    currentMode = 'creator';
    currentQuestionSet = [];
    currentQuestionIndex = 0;
    sessionAnswered = [];
    testSession = null;
    headerTitle.textContent = 'Vytvořit test';
    btnHome.style.display = 'block';

    appEl.innerHTML = `
        <div class="card">
            <h2>Vytvořit test</h2>
            <label class="form-label">Kolik otázek chcete v testu?</label>
            <input id="test-question-count" type="number" min="1" value="5" class="form-input">
            <div class="form-label">Vyberte kvízy:</div>
            <div class="quiz-selection">
                ${quizIndex.map(q => `
                    <label class="checkbox-label">
                        <input type="checkbox" name="selectQuiz" value="${q.id}">
                        ${q.title}
                    </label>
                `).join('')}
            </div>
            <button id="btn-start-test">Spustit test</button>
        </div>
    `;

    document.getElementById('btn-start-test').addEventListener('click', startCustomTest);
}

async function startCustomTest() {
    const count = Number(document.getElementById('test-question-count').value);
    const selectedQuizIds = Array.from(document.querySelectorAll('input[name="selectQuiz"]:checked')).map(i => i.value);

    if (!count || count < 1) {
        alert('Zadejte platný počet otázek.');
        return;
    }
    if (!selectedQuizIds.length) {
        alert('Vyberte alespoň jeden kvíz.');
        return;
    }

    try {
        const loaded = await Promise.all(selectedQuizIds.map(id => loadQuizData(id)));
        const allQuestions = [];

        selectedQuizIds.forEach((quizId, index) => {
            const quizData = loaded[index];
            const quizTitle = quizIndex.find(q => q.id === quizId).title;
            quizData.questions.forEach(question => {
                allQuestions.push({
                    ...question,
                    _quizId: quizId,
                    _quizTitle: quizTitle,
                });
            });
        });

        if (!allQuestions.length) {
            alert('V těchto kvízech nejsou žádné otázky.');
            return;
        }
        if (count > allQuestions.length) {
            alert(`Vybráno je pouze ${allQuestions.length} otázek, zvolte menší počet nebo další kvízy.`);
            return;
        }

        const selectedQuestions = shuffleArray(allQuestions).slice(0, count);
        currentQuestionSet = selectedQuestions;
        currentQuestionIndex = 0;
        testSession = {
            id: generateId(),
            createdAt: new Date().toISOString(),
            quizIds: selectedQuizIds,
            quizTitles: selectedQuizIds.map(id => quizIndex.find(q => q.id === id).title),
            total: selectedQuestions.length,
            answers: {},
            questionSet: selectedQuestions.map(q => ({ ...q })),
            isSubmitted: false,
            finishedAt: null,
            correctCount: 0,
            historySaved: false,
        };
        currentMode = 'test';
        renderQuestion();
    } catch (e) {
        alert('Chyba při načítání otázek.');
    }
}

function saveTestHistory(session) {
    const entry = {
        id: session.id,
        createdAt: session.createdAt,
        finishedAt: session.finishedAt,
        quizIds: session.quizIds || [],
        quizTitles: session.quizTitles,
        total: session.total,
        answers: { ...session.answers },
        questionSet: session.questionSet.map(q => ({
            id: q.id,
            text: q.text,
            options: q.options.map(opt => ({ text: opt.text, isCorrect: opt.isCorrect })),
            _quizTitle: q._quizTitle,
        })),
        isSubmitted: session.isSubmitted,
        correctCount: session.correctCount,
    };

    const existingIndex = quizHistory.findIndex(item => item.id === session.id);
    if (existingIndex !== -1) {
        quizHistory[existingIndex] = entry;
    } else {
        quizHistory.unshift(entry);
    }
    saveHistory();
    session.historySaved = true;
}

function exitTest() {
    if (currentMode === 'test' && testSession) {
        if (!testSession.historySaved) {
            testSession.finishedAt = new Date().toISOString();
            saveTestHistory(testSession);
        }
        testSession = null;
    }
    renderHome();
}

function continueTest(entryId) {
    const entry = quizHistory.find(item => item.id === entryId);
    if (!entry) {
        alert('Test nenalezen.');
        return;
    }
    if (entry.isSubmitted) {
        alert('Tento test je již dokončený.');
        return;
    }

    testSession = {
        id: entry.id,
        createdAt: entry.createdAt,
        quizIds: entry.quizIds || [],
        quizTitles: entry.quizTitles,
        total: entry.total,
        answers: { ...entry.answers },
        questionSet: entry.questionSet.map(q => ({ ...q })),
        isSubmitted: false,
        finishedAt: entry.finishedAt,
        correctCount: entry.correctCount || 0,
        historySaved: true,
    };

    currentQuestionSet = testSession.questionSet;
    currentQuestionIndex = currentQuestionSet.findIndex(q => !(q.id in testSession.answers) || !testSession.answers[q.id].length);
    if (currentQuestionIndex === -1) currentQuestionIndex = 0;
    currentMode = 'test';
    renderQuestion();
}

function startQuiz(mode) {
    currentMode = mode;
    const state = appState[currentQuiz.id];
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
    if (currentMode === 'test') {
        renderTestQuestion();
        return;
    }

    if (currentQuestionIndex >= currentQuestionSet.length) {
        appEl.innerHTML = `<div class="card"><h2>Konec režimu 🎉</h2><button onclick="loadAndRenderQuizMenu('${currentQuiz.id}')">Zpět do menu</button></div>`;
        return;
    }
    if (currentQuestionIndex < 0) currentQuestionIndex = 0;

    const question = currentQuestionSet[currentQuestionIndex];
    const state = appState[currentQuiz.id];
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
            <div class="question-header">
                <button onclick="loadAndRenderQuizMenu('${currentQuiz.id}')">← Zpět</button>
                <span>${currentQuestionIndex + 1} / ${currentQuestionSet.length}</span>
                <button class="btn-save" id="btn-toggle-save">${isSaved ? '★' : '☆'}</button>
            </div>
            <h3>${question.text}</h3>
            ${imageHtml}
            <div class="options-container" id="options">
                ${shuffledOptions.map(opt => `
                    <label class="option-label">
                        <input type="checkbox" name="answer"
                               value="${opt.text}" data-correct="${opt.isCorrect}" ${isAnswered ? 'disabled' : ''}>
                        ${opt.text}
                    </label>
                `).join('')}
            </div>
            <div id="feedback-container"></div>
            <div class="controls">
                <button id="btn-prev" ${currentQuestionIndex === 0 ? 'disabled' : ''}>Předchozí</button>
                <button id="btn-submit" ${isAnswered ? 'style="display:none"' : ''}>Zkontrolovat</button>
                <button id="btn-next" ${currentQuestionIndex === currentQuestionSet.length - 1 ? 'disabled' : ''}>Další</button>
            </div>
            <button id="btn-learned" class="btn-success" style="display: none; width: 100%; margin-top: 10px;">Už to umím!</button>
        </div>
    `;

    document.getElementById('btn-submit')?.addEventListener('click', () => checkAnswer(question));
    document.getElementById('btn-prev').addEventListener('click', () => { currentQuestionIndex--; renderQuestion(); });
    document.getElementById('btn-next').addEventListener('click', () => { currentQuestionIndex++; renderQuestion(); });
    document.getElementById('btn-toggle-save').addEventListener('click', () => toggleSaved(question.id));

    if (isAnswered) showResults(question, false);
}

function renderCompletedTestSummary() {
    const percent = testSession.total ? Math.round((testSession.correctCount / testSession.total) * 100) : 0;
    const percentClass = percent >= 75 ? 'green-percent' : '';

    appEl.innerHTML = `
        <div class="card completed-summary-card">
            <div class="question-header">
                <button onclick="exitTest()">← Ukončit test</button>
                <span>${testSession.quizTitles.join(' • ')}</span>
                <span class="${percentClass}">${percent}%</span>
            </div>
            <div class="test-summary completed-summary">
                <strong>Výsledek:</strong> ${testSession.correctCount} / ${testSession.total} správně
            </div>
            ${testSession.questionSet.map((question, index) => {
                const selected = testSession.answers[question.id] || [];
                const correctOptions = question.options.filter(opt => opt.isCorrect).map(opt => opt.text);
                return `
                    <div class="card submitted-question-card">
                        <h3>${index + 1}. ${question.text}</h3>
                        <p class="history-source">Zdroj: ${question._quizTitle}</p>
                        <div class="options-container">
                            ${question.options.map(opt => {
                                const isSelected = selected.includes(opt.text);
                                const classes = [];
                                if (opt.isCorrect) classes.push('correct');
                                if (isSelected && !opt.isCorrect) classes.push('wrong');
                                return `
                                    <label class="option-label history-option ${classes.join(' ')}">
                                        <input type="checkbox" disabled ${isSelected ? 'checked' : ''}>
                                        ${opt.text}
                                    </label>
                                `;
                            }).join('')}
                        </div>
                        <p class="submitted-answer"><strong>Správná odpověď:</strong> ${correctOptions.join(', ') || 'Žádná'}</p>
                    </div>
                `;
            }).join('')}
            <div class="summary-actions">
                <button onclick="renderHome()">Domů</button>
                <button onclick="renderHistory()">Historie</button>
            </div>
        </div>
    `;
}

function renderTestQuestion() {
    if (!testSession || !testSession.questionSet.length) {
        renderHome();
        return;
    }

    if (testSession.isSubmitted) {
        renderCompletedTestSummary();
        return;
    }

    if (currentQuestionIndex >= testSession.questionSet.length) {
        currentQuestionIndex = testSession.questionSet.length - 1;
    }
    if (currentQuestionIndex < 0) currentQuestionIndex = 0;

    const question = testSession.questionSet[currentQuestionIndex];
    const savedAnswer = testSession.answers[question.id] || [];
    const shuffledOptions = shuffleArray(question.options);
    const imageHtml = question.image
        ? `<div class="question-image-container">
            <img src="${question.image}" alt="Otázka ${question.id}" class="question-image">
           </div>`
        : '';

    const questionStatus = testSession.isSubmitted
        ? `<div class="test-summary">Test odevzdán.</div>`
        : `<div class="test-summary">Otázka ${currentQuestionIndex + 1} / ${testSession.total}</div>`;

    appEl.innerHTML = `
        <div class="card">
            <div class="question-header">
                <button onclick="exitTest()">← Opustit test</button>
                <span>${testSession.quizTitles.join(' • ')}</span>
                <span>${currentQuestionIndex + 1} / ${testSession.questionSet.length}</span>
            </div>
            <h3>${question.text}</h3>
            ${imageHtml}
            ${questionStatus}
            <div class="options-container" id="options">
                ${shuffledOptions.map(opt => {
                    const checked = savedAnswer.includes(opt.text) ? 'checked' : '';
                    let labelClass = '';
                    if (testSession.isSubmitted) {
                        if (opt.isCorrect) labelClass = 'correct';
                        if (checked && !opt.isCorrect) labelClass = 'wrong';
                    }
                    return `
                        <label class="option-label ${labelClass}">
                            <input type="checkbox" name="answer" value="${opt.text}" ${checked} ${testSession.isSubmitted ? 'disabled' : ''}>
                            ${opt.text}
                        </label>
                    `;
                }).join('')}
            </div>
            <div class="controls">
                <button id="btn-prev" ${currentQuestionIndex === 0 ? 'disabled' : ''}>Předchozí</button>
                <button id="btn-submit" ${testSession.isSubmitted ? 'disabled' : ''}>${testSession.isSubmitted ? 'Odevzdané' : 'Odevzdat test'}</button>
                <button id="btn-next" ${currentQuestionIndex === testSession.questionSet.length - 1 ? 'disabled' : ''}>Další</button>
            </div>
            ${testSession.isSubmitted ? `<div class="test-summary"><strong>Správně:</strong> ${testSession.correctCount} / ${testSession.total}</div>` : ''}
        </div>
    `;

    document.querySelectorAll('input[name="answer"]').forEach(input => {
        input.addEventListener('change', () => updateTestAnswer(question.id, input.value, input.checked));
    });

    document.getElementById('btn-prev').addEventListener('click', () => { currentQuestionIndex--; renderQuestion(); });
    document.getElementById('btn-next').addEventListener('click', () => { currentQuestionIndex++; renderQuestion(); });
    document.getElementById('btn-submit').addEventListener('click', () => {
        if (!testSession.isSubmitted) submitTest();
    });
}

function updateTestAnswer(questionId, value, checked) {
    if (!testSession || testSession.isSubmitted) return;
    const answer = testSession.answers[questionId] || [];
    const index = answer.indexOf(value);

    if (checked && index === -1) {
        answer.push(value);
    }
    if (!checked && index !== -1) {
        answer.splice(index, 1);
    }
    testSession.answers[questionId] = answer;
}

function submitTest() {
    if (!testSession) return;

    const unansweredQuestions = testSession.questionSet.filter(q => !(q.id in testSession.answers) || !testSession.answers[q.id].length);
    if (unansweredQuestions.length) {
        if (!confirm(`V testu je ${unansweredQuestions.length} nezodpovězená otázka. Opravdu chcete odevzdat?`)) {
            return;
        }
    } else {
        if (!confirm('Opravdu chcete test odevzdat?')) {
            return;
        }
    }

    const entries = testSession.questionSet.map(question => {
        const selected = testSession.answers[question.id] || [];
        const correctAnswerTexts = question.options.filter(opt => opt.isCorrect).map(opt => opt.text);
        const normalizedSelected = [...selected].sort().join('|');
        const normalizedCorrect = [...correctAnswerTexts].sort().join('|');
        const isCorrect = normalizedSelected === normalizedCorrect;
        return { isCorrect, selected };
    });

    const correctCount = entries.filter(item => item.isCorrect).length;
    testSession.isSubmitted = true;
    testSession.finishedAt = new Date().toISOString();
    testSession.correctCount = correctCount;
    saveTestHistory(testSession);
    renderQuestion();
}

function checkAnswer(question) {
    const inputs = document.querySelectorAll('input[name="answer"]');
    if (![...inputs].some(i => i.checked)) {
        alert('Vyber odpověď!');
        return;
    }

    const state = appState[currentQuiz.id];
    if (!state.answered.includes(question.id)) {
        state.answered.push(question.id);
    }
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
                if (currentQuestionIndex >= currentQuestionSet.length - 1) loadAndRenderQuizMenu(currentQuiz.id);
                else { currentQuestionIndex++; renderQuestion(); }
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
