(function () {
  const data = window.testData;
  if (!data) throw new Error("Не удалось загрузить данные теста");

  const startScreen = document.getElementById("start-screen");
  const quizScreen = document.getElementById("quiz-screen");
  const resultScreen = document.getElementById("result-screen");
  const questionContainer = document.getElementById("question-container");
  const optionsContainer = document.getElementById("options-container");
  const progressLabel = document.getElementById("progress-label");
  const progressFill = document.getElementById("progress-fill");
  const stepIndicator = document.getElementById("step-indicator");
  const blockLabel = document.getElementById("block-label");
  const selectionHint = document.getElementById("selection-hint");
  const timerEl = document.getElementById("timer");

  const startBtn = document.getElementById("start-btn");
  const nextBtn = document.getElementById("next-btn");
  const prevBtn = document.getElementById("prev-btn");
  const skipBtn = document.getElementById("skip-btn");
  const restartBtn = document.getElementById("restart-btn");
  const exportBtn = document.getElementById("export-btn");
  const answersToggle = document.getElementById("answers-toggle");
  const answersPanel = document.getElementById("answers-panel");
  const usernameInput = document.getElementById("username");

  const resultGreeting = document.getElementById("result-greeting");
  const resultTitle = document.getElementById("result-title");
  const resultScore = document.getElementById("result-score");
  const resultLevel = document.getElementById("result-level");
  const resultInterpretation = document.getElementById("result-interpretation");
  const mistakeList = document.getElementById("mistake-list");
  const resultSummary = document.getElementById("result-summary");
  const resultTime = document.getElementById("result-time");

  const total = data.questions.length;
  const answers = Array.from({ length: total }, () => ({ value: null, skipped: false }));
  let currentIndex = 0;
  let timeLeft = data.timeLimitSec || 0;
  let timerId = null;
  let startedAt = null;

  function showScreen(screen) {
    [startScreen, quizScreen, resultScreen].forEach((el) => el.classList.add("hidden"));
    screen.classList.remove("hidden");
  }

  function formatTime(seconds) {
    const clamped = Math.max(0, Math.floor(seconds));
    const m = String(Math.floor(clamped / 60)).padStart(2, "0");
    const s = String(clamped % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function updateTimerUi() {
    timerEl.textContent = formatTime(timeLeft);
    timerEl.classList.toggle("warning", timeLeft <= 60);
  }

  function startTimer() {
    startedAt = new Date();
    timeLeft = data.timeLimitSec;
    updateTimerUi();
    timerId = setInterval(() => {
      timeLeft -= 1;
      updateTimerUi();
      if (timeLeft === 60) {
        selectionHint.textContent = "Осталась 1 минута";
      }
      if (timeLeft <= 0) {
        finishTest(true);
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function renderQuestion(index) {
    const question = data.questions[index];
    if (!question) return;

    questionContainer.textContent = question.text;
    blockLabel.textContent = question.block || "";
    optionsContainer.innerHTML = "";

    if (question.type === "choice") {
      renderChoice(question, answers[index]);
    } else if (question.type === "number") {
      renderNumber(question, answers[index]);
    }

    updateNavigationState();
    updateProgress(index);
  }

  function renderChoice(question, answerState) {
    question.options.forEach((option, idx) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option" + (answerState.value === idx ? " selected" : "");
      button.textContent = option;
      button.addEventListener("click", () => onSelectAnswer(idx));
      optionsContainer.appendChild(button);
    });
  }

  function renderNumber(question, answerState) {
    const wrapper = document.createElement("div");
    const input = document.createElement("input");
    input.type = "number";
    input.className = "number-input";
    input.placeholder = "Введи число";
    input.value = answerState.value ?? "";
    input.addEventListener("input", (event) => {
      const val = event.target.value;
      const parsed = val === "" ? null : Number(val);
      if (val !== "" && Number.isNaN(parsed)) return;
      onSelectAnswer(parsed);
    });
    wrapper.appendChild(input);
    optionsContainer.appendChild(wrapper);
  }

  function updateNavigationState() {
    prevBtn.disabled = currentIndex === 0;
    const state = answers[currentIndex];
    const hasValue = state.value !== null && state.value !== undefined && state.value !== "";
    nextBtn.disabled = !hasValue && !state.skipped;
    selectionHint.textContent = state.skipped ? "Ответ пропущен, можно вернуться позже" : "Можно пропустить и вернуться позже";
  }

  function updateProgress(index) {
    const step = index + 1;
    progressLabel.textContent = `Вопрос ${step} из ${total}`;
    stepIndicator.textContent = `${String(step).padStart(2, "0")} / ${total}`;
    const percent = Math.round((step / total) * 100);
    progressFill.style.width = `${percent}%`;
  }

  function onSelectAnswer(value) {
    answers[currentIndex] = { value, skipped: false };
    renderQuestion(currentIndex);
  }

  function skipQuestion() {
    answers[currentIndex] = { value: null, skipped: true };
    goToNext();
  }

  function goToNext() {
    const state = answers[currentIndex];
    const hasValue = state.value !== null && state.value !== undefined && state.value !== "";
    if (!hasValue && !state.skipped) return;
    if (currentIndex < total - 1) {
      currentIndex += 1;
      renderQuestion(currentIndex);
    } else {
      finishTest(false);
    }
  }

  function goToPrev() {
    if (currentIndex === 0) return;
    currentIndex -= 1;
    renderQuestion(currentIndex);
  }

  function isChoiceCorrect(question, answerState) {
    if (answerState.value === null || answerState.value === undefined) return false;
    return Number(answerState.value) === question.correctKey;
  }

  function isNumberCorrect(question, answerState) {
    if (answerState.value === null || answerState.value === undefined || answerState.value === "") return false;
    const expected = Number(question.correctNumber);
    const tolerance = typeof question.tolerance === "number" ? question.tolerance : 0;
    const actual = Number(answerState.value);
    if (Number.isNaN(actual)) return false;
    return Math.abs(actual - expected) <= tolerance;
  }

  function evaluateQuestion(question, answerState) {
    if (question.type === "choice") return isChoiceCorrect(question, answerState);
    if (question.type === "number") return isNumberCorrect(question, answerState);
    return false;
  }

  function computeScore() {
    let score = 0;
    const mistakes = [];

    data.questions.forEach((question, idx) => {
      const correct = evaluateQuestion(question, answers[idx]);
      if (correct) {
        score += 1;
      } else {
        mistakes.push({ index: idx, question });
      }
    });

    return { score, mistakes };
  }

  function findBand(score) {
    return data.resultBands.find((band) => score >= band.min && score <= band.max) || null;
  }

  function buildMistakeList(mistakes) {
    mistakeList.innerHTML = "";
    if (!mistakes.length) {
      const ok = document.createElement("li");
      ok.textContent = "Ошибок нет";
      mistakeList.appendChild(ok);
      return;
    }

    mistakes.forEach(({ question }) => {
      const li = document.createElement("li");
      li.textContent = `№${question.id}: ${question.text}`;
      mistakeList.appendChild(li);
    });
  }

  function buildAnswersAccordion() {
    answersPanel.innerHTML = "";
    data.questions.forEach((question, idx) => {
      const item = document.createElement("div");
      item.className = "accordion-item";

      const questionEl = document.createElement("p");
      questionEl.className = "accordion-question";
      questionEl.textContent = `№${question.id}. ${question.text}`;

      const answerEl = document.createElement("p");
      answerEl.className = "accordion-answer";
      if (question.type === "choice") {
        answerEl.textContent = `Верный вариант: ${question.options[question.correctKey]}`;
      } else {
        const tolerance = question.tolerance ? ` (±${question.tolerance})` : "";
        answerEl.textContent = `Верный ответ: ${question.correctNumber}${tolerance}`;
      }

      item.appendChild(questionEl);
      item.appendChild(answerEl);
      answersPanel.appendChild(item);
    });
  }

  function finishTest(byTimeout) {
    stopTimer();
    const finishedAt = new Date();
    const durationSec = startedAt ? Math.round((finishedAt - startedAt) / 1000) : data.timeLimitSec;

    const { score, mistakes } = computeScore();
    const band = findBand(score);

    const username = usernameInput.value.trim();
    resultGreeting.textContent = username ? `${username}, твой результат` : "Готово!";
    resultTitle.textContent = data.title;
    resultScore.textContent = `${score} / ${total}`;
    resultLevel.textContent = band ? band.title : "Уровень не определён";
    resultInterpretation.textContent = band ? band.text : "Нет интерпретации";

    buildMistakeList(mistakes);
    buildAnswersAccordion();

    const summary = data.questions
      .map((question, idx) => {
        const answerState = answers[idx];
        if (!answerState || answerState.value === null || answerState.value === undefined || answerState.value === "") return "—";
        if (question.type === "choice") return question.options[Number(answerState.value)] ?? "—";
        return String(answerState.value);
      })
      .join(" | ");
    resultSummary.textContent = `Ответы: ${summary}`;

    const timeText = byTimeout ? "Время истекло" : "Завершено досрочно";
    const remaining = Math.max(0, timeLeft);
    resultTime.textContent = `${timeText}. Использовано: ${formatTime(durationSec)}. Осталось: ${formatTime(remaining)}.`;

    showScreen(resultScreen);
  }

  function restart() {
    for (let i = 0; i < answers.length; i += 1) {
      answers[i].value = null;
      answers[i].skipped = false;
    }
    currentIndex = 0;
    timeLeft = data.timeLimitSec;
    updateTimerUi();
    selectionHint.textContent = "Можно пропустить и вернуться позже";
    showScreen(startScreen);
  }

  function exportResult() {
    const finishedAt = new Date();
    const { score } = computeScore();
    const band = findBand(score);

    const payload = {
      testId: data.id,
      testTitle: data.title,
      name: usernameInput.value.trim() || null,
      answers,
      score,
      level: band ? band.title : null,
      interpretation: band ? band.text : null,
      timeLimitSec: data.timeLimitSec,
      remainingTimeSec: Math.max(0, timeLeft),
      timeUsedSec: Math.max(0, data.timeLimitSec - Math.max(0, timeLeft)),
      finishedByTimeout: timeLeft <= 0,
      completedAt: finishedAt.toISOString()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.id}-result.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  answersToggle.addEventListener("click", () => {
    const isHidden = answersPanel.classList.contains("hidden");
    answersPanel.classList.toggle("hidden", !isHidden);
    answersToggle.setAttribute("aria-expanded", String(isHidden));
    answersPanel.setAttribute("aria-hidden", String(!isHidden));
  });

  startBtn.addEventListener("click", () => {
    startTimer();
    showScreen(quizScreen);
    renderQuestion(currentIndex);
    usernameInput.blur();
  });

  nextBtn.addEventListener("click", goToNext);
  prevBtn.addEventListener("click", goToPrev);
  skipBtn.addEventListener("click", skipQuestion);
  restartBtn.addEventListener("click", () => {
    stopTimer();
    restart();
  });
  exportBtn.addEventListener("click", exportResult);

  // Pre-render first question for perceived performance and timer state
  renderQuestion(currentIndex);
  updateTimerUi();
})();
