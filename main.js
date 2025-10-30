let questions = [];
let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let wrongQuestions = JSON.parse(localStorage.getItem('wrongQuestions')) || [];
let startTime = 0;
let timerInterval = null;
let isPreviewMode = false;

// MỚI: theo dõi câu đã trả lời trong session hiện tại và danh sách câu sai trong lần làm này
let sessionAnswered = new Set(); // chứa originalIndex của các câu đã trả lời (bất kể đúng/sai)
let sessionWrongList = []; // chứa originalIndex của các câu sai trong lần làm này (để show list)

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
  if (!select) return;
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
  // reset session trackers
  sessionAnswered = new Set();
  sessionWrongList = [];

  if (mode === 'all') {
    currentQuestions = questions.map((q, i) => ({
      ...q,
      originalIndex: i,
      answered: false, // MỚI: trạng thái đã trả lời
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
      .map((idx) => ({
        ...questions[idx],
        originalIndex: idx,
        answered: false,
      }));
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
    currentQuestions = shuffled.slice(0, 40).map((q) => ({
      ...q,
      originalIndex: questions.indexOf(q),
      answered: false,
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
    answered: false,
  }));
  document.getElementById('partSelector').style.display = 'none';
  startQuiz();
}

function startQuiz() {
  document.getElementById('partSelect').value = '';
  currentIndex = 0;
  score = 0;
  isPreviewMode = false;
  startTime = Date.now();
  startTimer();
  renderQuestion();
  document.getElementById('endButton').style.display = 'block';
  document.getElementById('shuffleButton').style.display = 'block';
}

function startTimer() {
  clearInterval(timerInterval);
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

  // Tạo danh sách lựa chọn
  const optionsHtml = Object.entries(q.options)
    .map(
      ([key, value]) => `
      <div class="option-item" data-key="${key}" onclick="selectAnswer('${key}')">
        <strong>${key}.</strong> ${value}
        <p id="translated-${key}" style="font-size:14px; color:var(--primary); font-style:italic;"></p>
      </div>
    `
    )
    .join('');

  div.innerHTML = `
    <div class="question-counter" style="display:flex; justify-content:space-between; align-items:center">
      <div>Câu ${qNum}/${total}</div>
      <div>
        <button 
          id="summarizeBtn-${currentIndex}"
          onclick="summarizeWithAI(${currentIndex}, this)"
          style="border:none; border-radius:10px; padding:5px 5px; margin:0 4px; cursor:pointer; font-size:12px; background:#eee; color:var(--primary); font-weight:600">
          ✨ Phân tích
        </button>
        <button 
          id="translateBtn-${currentIndex}"
          onclick="translateWithAI(${currentIndex}, this)"
          style="border:none; border-radius:10px; padding:5px 8px; margin:0 4px; cursor:pointer; font-size:12px; background:#eee; color:var(--primary); font-weight:600">
          🌐 Dịch
        </button>
      </div>
    </div>

    <div class="question-text" id="questionText">
        ${q.question}
        <br/>
        <span id="translatedText" style="font-size:14px; color:var(--primary); font-style:italic;"></span>
    </div>

    <div class="options">${optionsHtml}</div>
  `;

  form.appendChild(div);

  // Nếu câu hỏi đã được trả lời
  const optionEls = form.querySelectorAll('.option-item');
  if (q.answered) {
    optionEls.forEach((el) => {
      el.style.pointerEvents = 'none';
      const key = el.getAttribute('data-key');
      if (key === q.answer) el.classList.add('correct');
      else if (q.selectedKey && key === q.selectedKey)
        el.classList.add('wrong');
      el.classList.add('disabled');
    });
  }

  updateProgress();
  showActionButtons();
}

// Mở modal hiển thị kết quả
function openAiModal(title, content) {
  const modal = document.getElementById('aiModal');
  const modalTitle = document.getElementById('aiModalTitle');
  const modalBody = document.getElementById('aiModalBody');

  modalTitle.innerHTML = title;
  modalBody.innerHTML = `<div class="typing">${content}</div>`;
  modal.style.display = 'block';
}

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyOmFmtTLxvNoeH-KCOOgODI-H5ZPOOmbNT4Zylq3WzfR_IrwCyaRxzExCHXmp2-7Mo/exec';

// Biến để theo dõi trạng thái loading
let isSummarizeLoading = false;
let isTranslateLoading = false;

// 🔹 Gọi AI thực tế qua Google Apps Script API
async function summarizeWithAI(index, button) {
  // Nếu đang loading thì không làm gì
  if (isSummarizeLoading) return;

  const q = currentQuestions[index];

  // Set trạng thái loading
  isSummarizeLoading = true;
  button.disabled = true;
  button.innerHTML = '⏳ Đang xử lý...';

  try {
    // Chuẩn bị dữ liệu POST
    const postData = JSON.stringify({
      question: q.question,
      options: q.options,
      answer: q.answer,
    });

    // 🔹 Gửi câu hỏi tới Apps Script
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: postData,
    });

    // Cần kiểm tra response.ok vì Apps Script trả về lỗi 500 nếu có lỗi server
    if (!response.ok) {
      throw new Error(`Lỗi HTTP: ${response.status} ${response.statusText}`);
    }

    let data = await response.json();
    if (data.data.includes('```json:disable-run')) {
      data = JSON.parse(
        data.data.replace('```json:disable-run', '').replace('```', '')
      );
    } else if (data.data.includes('```json')) {
      data = JSON.parse(data.data.replace('```json', '').replace('```', ''));
    } else {
      data = JSON.parse(data.data);
    }

    if (data.error) throw new Error(data.error);

    // CHỈ MỞ MODAL KHI ĐÃ CALL API XONG
    openAiModal(
      'Tóm tắt bằng AI',
      `
      <div class="ai-result">
      ${
        data.explanation
          ? `<p class="mt-2"><strong>🧠 Giải thích:</strong> ${data.explanation}</p>`
          : ''
      }
        ${
          data.tip
            ? `<p class="mt-2"><strong>💡 Mẹo:</strong> ${data.tip}</p>`
            : ''
        }
      </div>
      `
    );
  } catch (error) {
    // Mở modal hiển thị lỗi
    openAiModal(
      'Lỗi',
      `<div class="error p-3 bg-red-100 rounded-md">❌ Lỗi khi gọi AI: ${error.message}</div>`
    );
    console.error('Lỗi gọi Apps Script:', error);
  } finally {
    // Reset trạng thái loading
    isSummarizeLoading = false;
    button.disabled = false;
    button.innerHTML = '✨';
    button.title = 'Tóm tắt bằng AI';
  }
}

// 🔹 Dịch mô phỏng (dịch cả câu hỏi & lựa chọn)
async function translateWithAI(index, button) {
  // Nếu đang loading thì không làm gì
  if (isTranslateLoading) return;

  const q = currentQuestions[index];
  const translatedEl = document.getElementById('translatedText');

  // Nếu đã hiển thị → ẩn đi
  if (translatedEl.style.display === 'block') {
    translatedEl.style.display = 'none';
    for (const key in q.options) {
      const optTrans = document.getElementById(`translated-${key}`);
      if (optTrans) optTrans.style.display = 'none';
    }
    return;
  }

  // Nếu chưa dịch → gọi AI
  // Set trạng thái loading
  isTranslateLoading = true;
  button.disabled = true;
  button.innerHTML = '⏳ Đang dịch...';

  const postData = JSON.stringify({
    action: 'translate', // Thêm action để phân biệt
    question: q.question,
    options: q.options,
  });

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: postData,
    });

    if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);

    let data = await response.json();
    if (data.data.includes('```json') || data.data.includes('```')) {
      data = JSON.parse(data.data.replace('```json', '').replace('```', ''));
    } else {
      data = JSON.parse(data.data);
    }

    if (data.error) throw new Error(data.error);

    translatedEl.style.display = 'block';
    // Cập nhật bản dịch
    translatedEl.textContent = data.translatedQuestion || q.question;

    // Cập nhật các đáp án dịch
    for (const key in q.options) {
      const optTrans = document.getElementById(`translated-${key}`);
      if (optTrans) {
        optTrans.textContent = data.translatedOptions?.[key] || q.options[key];
        optTrans.style.display = 'block';
      }
    }
  } catch (error) {
    translatedEl.innerHTML = `<span class="text-red-600">❌ Lỗi dịch: ${error.message}</span>`;
    console.error('Lỗi dịch:', error);
  } finally {
    // Reset trạng thái loading
    isTranslateLoading = false;
    button.disabled = false;
    button.innerHTML = '🌐';
    button.title = 'Dịch bằng AI';
  }
}

function selectAnswer(selected) {
  const q = currentQuestions[currentIndex];
  if (!q) return;

  // Nếu đã trả lời rồi thì không cho chọn lại
  if (q.answered) return;

  isPreviewMode = true;

  const optionEls = document.querySelectorAll('.option-item');

  // disable tất cả option để không thể click lại
  optionEls.forEach((el) => {
    el.style.pointerEvents = 'none';
    el.classList.add('disabled');
  });

  const correctEl = document.querySelector(
    `.option-item[data-key="${q.answer}"]`
  );
  const selectedEl = document.querySelector(
    `.option-item[data-key="${selected}"]`
  );

  // Đánh dấu selected cho phần tử được chọn (chỉ cho phần tử đó)
  if (selectedEl) selectedEl.classList.add('selected');

  // Ghi lại trạng thái đã trả lời cho câu này (session + currentQuestions)
  q.answered = true;
  q.selectedKey = selected; // lưu lựa chọn để render khi prev/next
  sessionAnswered.add(q.originalIndex);

  if (correctEl) {
    if (selected === q.answer) {
      correctEl.classList.add('correct');
      score++;

      // Nếu trước đó câu này tồn tại trong wrongQuestions (localStorage), xóa nó đi
      const idxInWrong = wrongQuestions.indexOf(q.originalIndex);
      if (idxInWrong !== -1) {
        wrongQuestions.splice(idxInWrong, 1);
        localStorage.setItem('wrongQuestions', JSON.stringify(wrongQuestions));
      }
    } else {
      // sai
      if (selectedEl) selectedEl.classList.add('wrong');
      correctEl.classList.add('correct');

      // thêm vào wrongQuestions (localStorage) nếu chưa có
      if (!wrongQuestions.includes(q.originalIndex)) {
        wrongQuestions.push(q.originalIndex);
        localStorage.setItem('wrongQuestions', JSON.stringify(wrongQuestions));
      }
      // thêm vào danh sách sai của session để show sau khi kết thúc
      if (!sessionWrongList.includes(q.originalIndex))
        sessionWrongList.push(q.originalIndex);
    }
  } else {
    if (selectedEl) selectedEl.classList.add('warning');
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
  if (!q) return;
  const correctEl = document.querySelector(
    `.option-item[data-key="${q.answer}"]`
  );
  if (correctEl) {
    // Mô phỏng click vào đáp án đúng (cũng sẽ ghi trạng thái answered)
    selectAnswer(q.answer);
    isPreviewMode = true;
  }
}

function prevQuestion() {
  isPreviewMode = false;
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

function nextQuestion() {
  isPreviewMode = false;
  if (currentIndex < currentQuestions.length - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    endQuiz();
  }
}

function shuffleQuestions() {
  if (currentQuestions.length <= 1) return;
  isPreviewMode = false;
  currentQuestions = shuffle(currentQuestions);
  currentIndex = 0;
  score = 0;
  // reset trạng thái câu trong session khi xáo trộn (bạn có thể giữ nếu muốn)
  currentQuestions.forEach((q) => {
    q.answered = false;
    delete q.selectedKey;
  });
  sessionAnswered = new Set();
  sessionWrongList = [];
  renderQuestion();
}

function showActionButtons() {
  const hasNext = currentIndex < currentQuestions.length - 1;
  const hasPrev = currentIndex > 0;
  let buttons = '';
  buttons += `<button class="btn btn-prev" ${
    !hasPrev ? 'disabled' : ''
  } onclick="prevQuestion()">
            <i class="fas fa-arrow-left"></i> Câu trước
          </button>`;
  if (hasNext) {
    buttons += `
          <button class="btn btn-next" onclick="nextQuestion()">
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
  const total = currentQuestions.length;
  const accuracy = ((score / total) * 100).toFixed(1);

  document.getElementById('modalScore').textContent = `${score} / ${total}`;
  document.getElementById('modalCorrect').textContent = score;
  document.getElementById('modalWrong').textContent =
    sessionWrongList.length || 0;
  document.getElementById('modalPercent').textContent = `${accuracy}%`;
  document.getElementById('modalTime').textContent =
    document.getElementById('timer').textContent;

  const modal = document.getElementById('resultModal');

  // Ẩn nút "Làm lại câu sai" nếu không có câu sai
  const retryBtn = document.getElementById('retryWrongSession');
  if (retryBtn) {
    if (sessionWrongList.length > 0) {
      retryBtn.style.display = 'block';
      retryBtn.onclick = () => {
        modal.style.display = 'none';
        retryWrongInSession(); // chạy lại các câu sai trong lần này
      };
    } else {
      retryBtn.style.display = 'none';
    }
  }

  modal.style.display = 'block';
  updateProgress(100);
}

function closeModal() {
  document.getElementById('resultModal').style.display = 'none';
  resetToMode();
}

function retryWrongInSession() {
  if (sessionWrongList.length === 0) {
    alert('Không có câu sai nào để làm lại!');
    resetToMode();
    return;
  }

  // Tạo danh sách quiz mới chỉ gồm các câu sai của lần này
  currentQuestions = sessionWrongList.map((idx) => ({
    ...questions[idx],
    originalIndex: idx,
    answered: false,
  }));

  // Reset các biến trạng thái
  sessionAnswered = new Set();
  sessionWrongList = [];
  score = 0;
  currentIndex = 0;
  startTime = Date.now();

  // Bắt đầu lại quiz
  startTimer();
  renderQuestion();
  document.getElementById('endButton').style.display = 'block';
  document.getElementById('shuffleButton').style.display = 'block';
}

function closeHelpModal() {
  document.getElementById('helpModal').style.display = 'none';
}

function closeAiModal() {
  document.getElementById('aiModal').style.display = 'none';
}

function updateProgress() {
  const percent = ((currentIndex + 1) / currentQuestions.length) * 100;
  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = percent + '%';
}

function resetToMode() {
  clearInterval(timerInterval);
  document.getElementById('modeSelection').style.display = 'block';
  document.getElementById('quizArea').style.display = 'none';
  document.getElementById('partSelector').style.display = 'none';
  document.getElementById('quizForm').innerHTML = '';
  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = '0%';
  document.getElementById('questionCounter').textContent =
    'Chọn chế độ để bắt đầu';
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('endButton').style.display = 'none';
  document.getElementById('shuffleButton').style.display = 'block';
  isPreviewMode = false;
  sessionAnswered = new Set();
  sessionWrongList = [];
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
const helpBtn = document.getElementById('helpButton');
if (helpBtn) {
  helpBtn.onclick = () => {
    document.getElementById('helpModal').style.display = 'block';
  };
}
