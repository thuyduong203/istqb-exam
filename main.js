let questions = [];
let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let wrongQuestions = JSON.parse(localStorage.getItem('wrongQuestions')) || [];
let startTime = 0;
let timerInterval = null;
let isPreviewMode = false;

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

fetch('questions.json')
  .then((res) => res.json())
  .then((data) => {
    questions = data;
    updatePartSelector();
  })
  .catch((err) => {
    console.error(err);
    alert('Không tải được file questions.json');
  });

function updatePartSelector() {
  const select = document.getElementById('partSelect');
  select.innerHTML = '<option value="">-- Chọn phần --</option>';
  const parts = Math.ceil(questions.length / 50);
  for (let i = 1; i <= parts; i++) {
    const start = (i - 1) * 50 + 1;
    const end = Math.min(i * 50, questions.length);
    select.add(new Option(`Phần ${i} (câu ${start}-${end})`, i));
  }
}

function startMode(mode) {
  document.getElementById('modeSelection').style.display = 'none';
  document.getElementById('quizArea').style.display = 'block';
  if (mode === 'all') {
    currentQuestions = questions.map((q, i) => ({
      ...q,
      originalIndex: i,
    }));
    startQuiz();
  } else if (mode === 'part') {
    document.getElementById('partSelector').style.display = 'block';
  } else if (mode === 'wrong') {
    if (wrongQuestions.length === 0) {
      alert('Bạn chưa có câu sai nào!');
      resetToMode();
      return;
    }
    currentQuestions = wrongQuestions
      .filter((idx) => questions[idx])
      .map((idx) => ({ ...questions[idx], originalIndex: idx }));
    if (currentQuestions.length === 0) {
      alert('Không còn câu sai hợp lệ!');
      resetToMode();
      return;
    }
    startQuiz();
  } else if (mode === 'random') {
    if (questions.length < 40) {
      alert(`Chỉ có ${questions.length} câu, không đủ 40 câu để thi thử!`);
      resetToMode();
      return;
    }
    const shuffled = shuffle(questions);
    currentQuestions = shuffled.slice(0, 40).map((q, i) => ({
      ...q,
      originalIndex: questions.indexOf(q),
    }));
    startQuiz();
  }
}

function selectPart(part) {
  if (!part) return;
  const start = (part - 1) * 50;
  const end = Math.min(start + 50, questions.length);
  currentQuestions = questions.slice(start, end).map((q, i) => ({
    ...q,
    originalIndex: start + i,
  }));
  document.getElementById('partSelector').style.display = 'none';
  startQuiz();
}

function startQuiz() {
  currentIndex = 0;
  score = 0;
  isPreviewMode = false;
  startTime = Date.now();
  startTimer();
  renderQuestion();
  document.getElementById('endButton').style.display = 'block';
}

function startTimer() {
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    document.getElementById('timer').textContent = `${mins}:${secs}`;
  }, 1000);
}

function renderQuestion() {
  const form = document.getElementById('quizForm');
  form.innerHTML = '';
  if (currentIndex >= currentQuestions.length) {
    endQuiz();
    return;
  }
  const q = currentQuestions[currentIndex];
  const qNum = currentIndex + 1;
  const total = currentQuestions.length;
  document.getElementById(
    'questionCounter'
  ).textContent = `Câu ${qNum}/${total}`;

  const div = document.createElement('div');
  div.className = 'question-box';
  div.innerHTML = `
          <div class="question-counter">Câu ${qNum}/${total}</div>
          <div class="question-text">${q.question}</div>
          <div class="options">
            ${Object.entries(q.options)
              .map(
                ([key, value]) => `
              <div class="option-item" data-key="${key}" onclick="selectAnswer('${key}')">
                <strong>${key}.</strong> ${value}
              </div>
            `
              )
              .join('')}
          </div>
        `;
  form.appendChild(div);
  updateProgress();
  showActionButtons();
}

function selectAnswer(selected) {
  const q = currentQuestions[currentIndex];
  document.querySelectorAll('.option-item').forEach((el) => {
    el.classList.add('selected');
    el.style.pointerEvents = 'none';
  });
  const correctEl = document.querySelector(
    `.option-item[data-key="${q.answer}"]`
  );
  const selectedEl = document.querySelector(
    `.option-item[data-key="${selected}"]`
  );

  if (correctEl) {
    if (selected === q.answer) {
      correctEl.classList.add('correct');
      score++;
    } else {
      selectedEl.classList.add('wrong');
      correctEl.classList.add('correct');
      if (!wrongQuestions.includes(q.originalIndex)) {
        wrongQuestions.push(q.originalIndex);
        localStorage.setItem('wrongQuestions', JSON.stringify(wrongQuestions));
      }
    }
  } else {
    selectedEl.classList.add('warning');
  }
  showActionButtons();
}

function previewAnswer() {
  if (isPreviewMode) {
    nextQuestion();
    isPreviewMode = false;
    return;
  }
  const q = currentQuestions[currentIndex];
  const correctEl = document.querySelector(
    `.option-item[data-key="${q.answer}"]`
  );
  if (correctEl) {
    correctEl.click();
    isPreviewMode = true;
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

function nextQuestion() {
  if (currentIndex < currentQuestions.length - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    endQuiz();
  }
}

function shuffleQuestions() {
  if (currentQuestions.length <= 1) return;
  currentQuestions = shuffle(currentQuestions);
  currentIndex = 0;
  score = 0;
  renderQuestion();
}

function showActionButtons() {
  const hasNext = currentIndex < currentQuestions.length - 1;
  const hasPrev = currentIndex > 0;
  let buttons = '';

  buttons += `<div style="display: flex; gap: 8px">${
    hasPrev
      ? `<button class="btn btn-prev" onclick="prevQuestion()">
            <i class="fas fa-arrow-left"></i> Câu trước
          </button>`
      : ''
  }
          <button class="btn btn-shuffle" onclick="shuffleQuestions()">
          <i class="fas fa-random"></i> Xáo trộn
        </button>
        </div>`;
  if (hasNext) {
    buttons += `<button class="btn btn-next" onclick="nextQuestion()">
            <i class="fas fa-arrow-right"></i> Câu tiếp
          </button>`;
  } else {
    buttons += `<button class="btn btn-end" onclick="endQuiz()">
            <i class="fas fa-check-circle"></i> Hoàn thành
          </button>`;
  }

  const existing = document.querySelector('.action-buttons');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = 'action-buttons';
  div.innerHTML = buttons;
  document.getElementById('quizForm').appendChild(div);
}

function endQuiz() {
  clearInterval(timerInterval);
  showResultModal();
}

function showResultModal() {
  const accuracy = ((score / currentQuestions.length) * 100).toFixed(1);
  document.getElementById(
    'modalScore'
  ).textContent = `${score} / ${currentQuestions.length}`;
  document.getElementById('modalCorrect').textContent = score;
  document.getElementById('modalWrong').textContent =
    currentQuestions.length - score;
  document.getElementById('modalPercent').textContent = `${accuracy}%`;
  document.getElementById('modalTime').textContent =
    document.getElementById('timer').textContent;
  document.getElementById('resultModal').style.display = 'block';
  updateProgress(100);
}

function closeModal() {
  document.getElementById('resultModal').style.display = 'none';
  resetToMode();
}

function closeHelpModal() {
  document.getElementById('helpModal').style.display = 'none';
}

function updateProgress() {
  const percent = ((currentIndex + 1) / currentQuestions.length) * 100;
  document.getElementById('progressBar').style.width = percent + '%';
}

function resetToMode() {
  clearInterval(timerInterval);
  document.getElementById('modeSelection').style.display = 'block';
  document.getElementById('quizArea').style.display = 'none';
  document.getElementById('partSelector').style.display = 'none';
  document.getElementById('quizForm').innerHTML = '';
  document.getElementById('progressBar').style.width = '0%';
  document.getElementById('questionCounter').textContent =
    'Chọn chế độ để bắt đầu';
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('endButton').style.display = 'none';
  isPreviewMode = false;
}

// === XỬ LÝ BÀN PHÍM ===
document.addEventListener('keydown', (e) => {
  if (document.getElementById('quizArea').style.display !== 'block') return;

  const key = e.key;

  switch (key) {
    case 'ArrowRight':
      e.preventDefault();
      nextQuestion();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      prevQuestion();
      break;
    case 's':
    case 'S':
      e.preventDefault();
      shuffleQuestions();
      break;
    case 'e':
    case 'E':
      e.preventDefault();
      endQuiz();
      break;
    case ' ':
      e.preventDefault();
      previewAnswer();
      break;

    // Thêm chọn nhanh đáp án bằng phím 1–4
    case '1':
    case '2':
    case '3':
    case '4':
      e.preventDefault();
      const q = currentQuestions[currentIndex];
      if (!q) return;
      const optionKeys = Object.keys(q.options);
      const selectedKey = optionKeys[parseInt(key) - 1]; // 1→A, 2→B, 3→C, 4→D
      if (selectedKey) selectAnswer(selectedKey);
      break;
  }
});

// Mở modal phím tắt
document.getElementById('helpButton').onclick = () => {
  document.getElementById('helpModal').style.display = 'block';
};
