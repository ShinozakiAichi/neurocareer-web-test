(function () {
  const data = window.testData;
  if (!data) {
    throw new Error("Не удалось загрузить тестовые данные");
  }

  const startScreen = document.getElementById("start-screen");
  const quizScreen = document.getElementById("quiz-screen");
  const resultScreen = document.getElementById("result-screen");
  const questionContainer = document.getElementById("question-container");
  const optionsContainer = document.getElementById("options-container");
  const progressLabel = document.getElementById("progress-label");
  const progressFill = document.getElementById("progress-fill");
  const stepIndicator = document.getElementById("step-indicator");
  const selectionHint = document.getElementById("selection-hint");

  const startBtn = document.getElementById("start-btn");
  const nextBtn = document.getElementById("next-btn");
  const prevBtn = document.getElementById("prev-btn");
  const restartBtn = document.getElementById("restart-btn");
  const exportBtn = document.getElementById("export-btn");
  const usernameInput = document.getElementById("username");

  const resultGreeting = document.getElementById("result-greeting");
  const resultTitle = document.getElementById("result-title");
  const resultRole = document.getElementById("result-role");
  const resultSuperpower = document.getElementById("result-superpower");
  const resultRoleDescription = document.getElementById("result-role-description");
  const resultLearning = document.getElementById("result-learning");
  const resultImage = document.getElementById("result-image");
  const resultBadge = document.getElementById("result-badge");
  const resultSummary = document.getElementById("result-summary");
  const questionCountLabel = document.getElementById("question-count");

  const total = data.questions.length;
  const answers = new Array(total);
  let currentIndex = 0;

  if (questionCountLabel) {
    questionCountLabel.textContent = total;
  }

  function showScreen(screen) {
    [startScreen, quizScreen, resultScreen].forEach((el) => el.classList.add("hidden"));
    screen.classList.remove("hidden");
  }

  function renderQuestion(index) {
    const question = data.questions[index];
    if (!question) return;

    questionContainer.classList.remove("fade-in");
    // Force reflow to replay animation
    void questionContainer.offsetWidth;
    questionContainer.textContent = question.text;
    questionContainer.classList.add("fade-in");
    optionsContainer.innerHTML = "";

    const selected = answers[index];
    question.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option" + (selected === option.key ? " selected" : "");
      button.setAttribute("data-key", option.key);
      button.innerHTML = `
        <span class="option-key">${option.key}</span>
        <span class="option-text">${option.text}</span>
      `;
      button.addEventListener("click", () => onSelectOption(option.key));
      optionsContainer.appendChild(button);
    });

    updateNavigationState();
    updateProgress(index);
  }

  function updateNavigationState() {
    prevBtn.disabled = currentIndex === 0;
    const hasAnswer = Boolean(answers[currentIndex]);
    nextBtn.disabled = !hasAnswer;
    selectionHint.textContent = hasAnswer ? "Можно перейти к следующему вопросу" : "Выбери вариант, чтобы продолжить";
  }

  function updateProgress(index) {
    const step = index + 1;
    progressLabel.textContent = `Вопрос ${step} из ${total}`;
    stepIndicator.textContent = `${String(step).padStart(2, "0")} / ${total}`;
    const percent = Math.round((step / total) * 100);
    progressFill.style.width = `${percent}%`;
  }

  function onSelectOption(key) {
    answers[currentIndex] = key;
    renderQuestion(currentIndex);
  }

  function goToNext() {
    if (!answers[currentIndex]) return;
    if (currentIndex < total - 1) {
      currentIndex += 1;
      renderQuestion(currentIndex);
    } else {
      showResult();
    }
  }

  function goToPrev() {
    if (currentIndex === 0) return;
    currentIndex -= 1;
    renderQuestion(currentIndex);
  }

  function computeWinner() {
    const tally = { А: 0, Б: 0, В: 0, Г: 0 };
    answers.forEach((key) => {
      if (tally[key] !== undefined) {
        tally[key] += 1;
      }
    });

    const max = Math.max(...Object.values(tally));
    const leaders = Object.keys(tally).filter((key) => tally[key] === max);

    const tieBreakQuestions = [0, 3];
    const priority = ["А", "Б", "В", "Г"];

    const tieBreakWinner = tieBreakQuestions
      .map((idx) => answers[idx])
      .find((candidate) => leaders.includes(candidate));

    const winner =
      tieBreakWinner ||
      priority.find((letter) => leaders.includes(letter)) ||
      leaders[0];

    return { winner, tally };
  }

  function showResult() {
    const { winner, tally } = computeWinner();
    const profile = data.profiles[winner];
    if (!profile) {
      throw new Error("Профиль не найден");
    }

    const username = usernameInput.value.trim();
    resultGreeting.textContent = username ? `${username}, твой результат` : "Готово!";
    resultTitle.textContent = profile.title;
    resultRole.textContent = `Лидирует буква ${winner}`;
    resultSuperpower.textContent = profile.superpower;
    resultRoleDescription.textContent = profile.role;

    resultLearning.innerHTML = "";
    profile.learning.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      resultLearning.appendChild(li);
    });

    resultImage.src = profile.image;
    resultImage.alt = profile.title;
    resultBadge.textContent = winner;

    const summary = Object.entries(tally)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" • ");
    resultSummary.textContent = `Выборы: ${summary}`;

    showScreen(resultScreen);
  }

  function restart() {
    answers.fill(undefined);
    currentIndex = 0;
    usernameInput.value = "";
    showScreen(startScreen);
  }

  function exportResult() {
    const { winner, tally } = computeWinner();
    const profile = data.profiles[winner];
    const payload = {
      name: usernameInput.value.trim() || null,
      profileKey: winner,
      profileTitle: profile.title,
      superpower: profile.superpower,
      role: profile.role,
      learning: profile.learning,
      answers,
      stats: tally,
      completedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "neurocareer-result.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  startBtn.addEventListener("click", () => {
    showScreen(quizScreen);
    renderQuestion(currentIndex);
    usernameInput.blur();
  });

  nextBtn.addEventListener("click", goToNext);
  prevBtn.addEventListener("click", goToPrev);
  restartBtn.addEventListener("click", restart);
  exportBtn.addEventListener("click", exportResult);

  // Init first question for better perceived performance
  renderQuestion(currentIndex);
})();
