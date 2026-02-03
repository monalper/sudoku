(() => {
  const STORAGE_KEY = "sudoku_high_scores_v1";
  const ALL_CANDIDATES_MASK = 0b1111111110; // bits 1..9
  const MAX_MISTAKES = 3;

  const DIFFICULTIES = {
    easy: { label: "Kolay", targetClues: 40, multiplier: 1 },
    medium: { label: "Orta", targetClues: 32, multiplier: 2 },
    hard: { label: "Zor", targetClues: 26, multiplier: 3 },
    expert: { label: "Usta", targetClues: 22, multiplier: 4 },
  };

  const BIT_TO_NUM = (() => {
    const map = new Array(1 << 10).fill(0);
    for (let n = 1; n <= 9; n++) map[1 << n] = n;
    return map;
  })();

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const deepCopyBoard = (board) => board.slice();

  const rowOf = (idx) => Math.floor(idx / 9);
  const colOf = (idx) => idx % 9;
  const boxOf = (r, c) => Math.floor(r / 3) * 3 + Math.floor(c / 3);

  const popcount = (mask) => {
    let count = 0;
    while (mask) {
      mask &= mask - 1;
      count++;
    }
    return count;
  };

  const countSolutions = (board, limit = 2) => {
    const rows = new Array(9).fill(0);
    const cols = new Array(9).fill(0);
    const boxes = new Array(9).fill(0);

    for (let idx = 0; idx < 81; idx++) {
      const val = board[idx];
      if (val === 0) continue;
      const r = rowOf(idx);
      const c = colOf(idx);
      const b = boxOf(r, c);
      const bit = 1 << val;
      if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) return 0;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
    }

    let found = 0;

    const backtrack = () => {
      if (found >= limit) return;

      let bestIdx = -1;
      let bestMask = 0;
      let bestCount = 10;

      for (let idx = 0; idx < 81; idx++) {
        if (board[idx] !== 0) continue;
        const r = rowOf(idx);
        const c = colOf(idx);
        const b = boxOf(r, c);
        const mask = ALL_CANDIDATES_MASK & ~(rows[r] | cols[c] | boxes[b]);
        const cnt = popcount(mask);
        if (cnt === 0) return;
        if (cnt < bestCount) {
          bestCount = cnt;
          bestIdx = idx;
          bestMask = mask;
          if (cnt === 1) break;
        }
      }

      if (bestIdx === -1) {
        found++;
        return;
      }

      const r = rowOf(bestIdx);
      const c = colOf(bestIdx);
      const b = boxOf(r, c);

      for (let mask = bestMask; mask; mask &= mask - 1) {
        const bit = mask & -mask;
        const val = BIT_TO_NUM[bit];
        board[bestIdx] = val;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;

        backtrack();

        rows[r] &= ~bit;
        cols[c] &= ~bit;
        boxes[b] &= ~bit;
        board[bestIdx] = 0;

        if (found >= limit) return;
      }
    };

    backtrack();
    return found;
  };

  const generateSolvedBoard = () => {
    const base = 3;
    const side = base * base; // 9

    const bands = shuffle([0, 1, 2]);
    const stacks = shuffle([0, 1, 2]);

    const rows = [];
    const cols = [];

    for (const band of bands) {
      for (const r of shuffle([0, 1, 2])) rows.push(band * base + r);
    }

    for (const stack of stacks) {
      for (const c of shuffle([0, 1, 2])) cols.push(stack * base + c);
    }

    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const pattern = (r, c) => (base * (r % base) + Math.floor(r / base) + c) % side;

    const board = new Array(81);
    for (let r = 0; r < side; r++) {
      for (let c = 0; c < side; c++) {
        board[r * 9 + c] = nums[pattern(rows[r], cols[c])];
      }
    }
    return board;
  };

  const generatePuzzle = (solution, targetClues) => {
    const puzzle = deepCopyBoard(solution);
    let clues = 81;

    const positions = shuffle([...Array(81).keys()]);
    for (const idx of positions) {
      if (clues <= targetClues) break;
      const saved = puzzle[idx];
      puzzle[idx] = 0;
      const solutions = countSolutions(puzzle, 2);
      if (solutions !== 1) {
        puzzle[idx] = saved;
      } else {
        clues--;
      }
    }

    return { puzzle, clues };
  };

  const loadHighScores = () => {
    const empty = {
      version: 1,
      byDifficulty: { easy: 0, medium: 0, hard: 0, expert: 0 },
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || !parsed.byDifficulty) return empty;
      const byDifficulty = { ...empty.byDifficulty, ...parsed.byDifficulty };
      return { version: 1, byDifficulty };
    } catch {
      return empty;
    }
  };

  const saveHighScores = (scores) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch {
      // Ignore storage failures (private mode, quota, etc.)
    }
  };

  const computeOverallHighScore = (scores) =>
    Math.max(0, ...Object.values(scores.byDifficulty || {}).map((n) => (Number.isFinite(n) ? n : 0)));

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

  const init = () => {
    const appEl = document.querySelector(".app");
    const boardEl = document.getElementById("board");
    const difficultyEl = document.getElementById("difficulty");
    const newGameEl = document.getElementById("newGame");
    const eraseEl = document.getElementById("erase");
    const checkEl = document.getElementById("check");
    const padEl = document.getElementById("pad");
    const timeEl = document.getElementById("time");
    const scoreEl = document.getElementById("score");
    const mistakesEl = document.getElementById("mistakes");
    const highScoreEl = document.getElementById("highScore");
    const toastEl = document.getElementById("toast");
    const waitingEl = document.getElementById("waiting");
    const finishDialogEl = document.getElementById("finishDialog");
    const finishTitleEl = document.getElementById("finishTitle");
    const finishSummaryEl = document.getElementById("finishSummary");
    const playAgainEl = document.getElementById("playAgain");
    const closeDialogEl = document.getElementById("closeDialog");

    const cellEls = new Array(81);

    let highScores = loadHighScores();

    const state = {
      difficultyKey: difficultyEl.value in DIFFICULTIES ? difficultyEl.value : "medium",
      solution: new Array(81).fill(0),
      puzzle: new Array(81).fill(0),
      current: new Array(81).fill(0),
      fixed: new Array(81).fill(false),
      clues: 0,
      mistakes: 0,
      waitingDismissed: false,
      startedAtMs: 0,
      elapsedSeconds: 0,
      timerId: null,
      selectedIdx: 0,
      busy: false,
      finished: false,
    };

    let toastTimer = null;

    const updateWaiting = () => {
      if (!waitingEl) return;
      const showWaiting =
        !state.busy && !state.finished && state.mistakes >= 2 && state.waitingDismissed !== true;
      waitingEl.classList.toggle("is-visible", showWaiting);
      waitingEl.setAttribute("aria-hidden", showWaiting ? "false" : "true");
    };

    const updateControls = () => {
      const disabledByBusy = state.busy;
      const disabledByFinished = state.finished;

      newGameEl.disabled = disabledByBusy;
      difficultyEl.disabled = disabledByBusy;

      const disableInput = disabledByBusy || disabledByFinished;
      eraseEl.disabled = disableInput;
      checkEl.disabled = disableInput;

      for (const cell of cellEls) {
        if (!cell) continue;
        cell.btn.disabled = disableInput;
      }

      for (const btn of padEl.querySelectorAll("button")) btn.disabled = disableInput;
      updateWaiting();
    };

    const setBusy = (busy) => {
      state.busy = busy;
      appEl.dataset.busy = busy ? "true" : "false";
      updateControls();
    };

    const toast = (msg) => {
      toastEl.textContent = msg;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastEl.textContent = "";
        toastTimer = null;
      }, 2400);
    };

    const buildBoardUI = () => {
      boardEl.innerHTML = "";
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const idx = r * 9 + c;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cell";
          btn.dataset.idx = String(idx);
          btn.setAttribute("role", "gridcell");
          btn.setAttribute("aria-label", `Satır ${r + 1}, Sütun ${c + 1}`);

          if (c === 2 || c === 5) btn.classList.add("b-right");
          if (r === 2 || r === 5) btn.classList.add("b-bottom");

          const valueEl = document.createElement("span");
          valueEl.className = "cell-value";
          btn.append(valueEl);
          btn.addEventListener("click", () => selectCell(idx, { focus: false }));
          boardEl.appendChild(btn);

          cellEls[idx] = { btn, valueEl };
        }
      }
    };

    const updateStats = () => {
      timeEl.textContent = formatTime(state.elapsedSeconds);
      scoreEl.textContent = `Skor ${computeScore()}`;
      highScoreEl.textContent = `En Yüksek ${computeOverallHighScore(highScores)}`;

      if (mistakesEl) {
        const remaining = Math.max(0, MAX_MISTAKES - state.mistakes);
        mistakesEl.textContent = `Hata ${state.mistakes}/${MAX_MISTAKES}`;
        mistakesEl.classList.toggle("is-danger", remaining <= 1);
      }

      updateWaiting();
    };

    const computeScore = () => {
      const diff = DIFFICULTIES[state.difficultyKey] || DIFFICULTIES.medium;
      const m = diff.multiplier;
      const fillable = 81 - state.clues;
      let correct = 0;

      for (let idx = 0; idx < 81; idx++) {
        if (state.fixed[idx]) continue;
        if (state.current[idx] !== 0 && state.current[idx] === state.solution[idx]) correct++;
      }

      const progressScore = correct * 50 * m;
      const timePenalty = state.elapsedSeconds * 2 * m;
      const mistakePenalty = state.mistakes * 120 * m;
      const completionBonus = state.finished && correct === fillable ? 1000 * m : 0;

      return Math.max(0, Math.round(progressScore - timePenalty - mistakePenalty + completionBonus));
    };

    const renderCell = (idx) => {
      const cell = cellEls[idx];
      const val = state.current[idx];
      const fixed = state.fixed[idx];

      cell.btn.classList.toggle("is-fixed", fixed);
      cell.btn.classList.toggle("is-user", !fixed && val !== 0);
      cell.btn.classList.toggle("is-wrong", !fixed && val !== 0 && val !== state.solution[idx]);

      cell.valueEl.textContent = val === 0 ? "" : String(val);
    };

    const renderAll = () => {
      for (let idx = 0; idx < 81; idx++) renderCell(idx);
      updateHighlights();
      updateStats();
    };

    const updateHighlights = () => {
      const selectedIdx = state.selectedIdx;
      const selectedVal = state.current[selectedIdx];
      const sr = rowOf(selectedIdx);
      const sc = colOf(selectedIdx);
      const sb = boxOf(sr, sc);

      for (let idx = 0; idx < 81; idx++) {
        const cell = cellEls[idx];
        const r = rowOf(idx);
        const c = colOf(idx);
        const b = boxOf(r, c);
        const isSelected = idx === selectedIdx;
        const isRelated = !isSelected && (r === sr || c === sc || b === sb);
        const isSame = !isSelected && selectedVal !== 0 && state.current[idx] === selectedVal;
        cell.btn.classList.toggle("is-selected", isSelected);
        cell.btn.classList.toggle("is-related", isRelated);
        cell.btn.classList.toggle("is-same", isSame);
      }
    };

    const selectCell = (idx, { focus }) => {
      state.selectedIdx = clamp(idx, 0, 80);
      updateHighlights();
      if (focus) {
        try {
          cellEls[state.selectedIdx].btn.focus({ preventScroll: true });
        } catch {
          cellEls[state.selectedIdx].btn.focus();
        }
      }
    };

    const moveSelection = (dr, dc) => {
      const r = rowOf(state.selectedIdx);
      const c = colOf(state.selectedIdx);
      const nr = clamp(r + dr, 0, 8);
      const nc = clamp(c + dc, 0, 8);
      selectCell(nr * 9 + nc, { focus: true });
    };

    const placeNumber = (n) => {
      if (state.busy || state.finished) return;
      const idx = state.selectedIdx;
      if (state.fixed[idx]) return;

      const prev = state.current[idx];
      if (prev === n) return;

      const isWrongNow = n !== 0 && n !== state.solution[idx];

      state.current[idx] = n;

      if (isWrongNow) {
        state.mistakes++;

        const cellBtn = cellEls[idx]?.btn;
        if (cellBtn) {
          cellBtn.classList.remove("is-mistake");
          // Retrigger animation even if user repeats a mistake quickly.
          void cellBtn.offsetWidth;
          cellBtn.classList.add("is-mistake");
          setTimeout(() => cellBtn.classList.remove("is-mistake"), 260);
        }

        const remaining = MAX_MISTAKES - state.mistakes;
        if (remaining > 0) toast(`Hatalı! Kalan hak: ${remaining}`);
      }

      renderCell(idx);
      updateHighlights();
      updateStats();

      if (state.mistakes >= MAX_MISTAKES) {
        endGame({ won: false, reason: "mistakes" });
        return;
      }
      maybeFinish();
    };

    const eraseSelected = () => {
      if (state.busy || state.finished) return;
      const idx = state.selectedIdx;
      if (state.fixed[idx]) return;
      state.current[idx] = 0;
      renderCell(idx);
      updateStats();
    };

    const checkBoard = () => {
      let empty = 0;
      let wrong = 0;
      for (let idx = 0; idx < 81; idx++) {
        const val = state.current[idx];
        if (val === 0) empty++;
        else if (val !== state.solution[idx]) wrong++;
      }
      if (wrong === 0 && empty === 0) {
        toast("Hepsi doğru görünüyor.");
        return;
      }
      toast(`Boş: ${empty} • Hatalı: ${wrong}`);
    };

    const maybeFinish = () => {
      for (let idx = 0; idx < 81; idx++) {
        if (state.current[idx] === 0) return;
        if (state.current[idx] !== state.solution[idx]) return;
      }
      endGame({ won: true });
    };

    const stopTimer = () => {
      if (!state.timerId) return;
      clearInterval(state.timerId);
      state.timerId = null;
    };

    const startTimer = () => {
      stopTimer();
      state.startedAtMs = Date.now();
      state.elapsedSeconds = 0;
      state.timerId = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.startedAtMs) / 1000);
        if (elapsed === state.elapsedSeconds) return;
        state.elapsedSeconds = elapsed;
        updateStats();
      }, 250);
    };

    const endGame = ({ won, reason } = { won: true, reason: "" }) => {
      state.finished = true;
      stopTimer();

      const finalScore = computeScore();
      if (won) {
        const prevBest = highScores.byDifficulty[state.difficultyKey] || 0;
        if (finalScore > prevBest) {
          highScores.byDifficulty[state.difficultyKey] = finalScore;
          saveHighScores(highScores);
        }
      }

      const overall = computeOverallHighScore(highScores);
      const diffLabel = (DIFFICULTIES[state.difficultyKey] || DIFFICULTIES.medium).label;

      if (finishTitleEl) finishTitleEl.textContent = won ? "Tebrikler!" : "Oyun Bitti";

      if (!won && reason === "mistakes") {
        finishSummaryEl.textContent = [
          `${MAX_MISTAKES} hata yaptın.`,
          `Seviye: ${diffLabel}`,
          `Süre: ${formatTime(state.elapsedSeconds)}`,
          `Skor: ${finalScore}`,
          `Genel En Yüksek: ${overall}`,
        ].join("\n");
      } else {
        finishSummaryEl.textContent = [
          `Seviye: ${diffLabel}`,
          `Süre: ${formatTime(state.elapsedSeconds)}`,
          `Hata: ${state.mistakes}`,
          `Skor: ${finalScore}`,
          `Genel En Yüksek: ${overall}`,
        ].join("\n");
      }

      if (typeof finishDialogEl.showModal === "function") finishDialogEl.showModal();
      updateControls();
      updateStats();
    };

    const startNewGame = async () => {
      state.difficultyKey = difficultyEl.value in DIFFICULTIES ? difficultyEl.value : "medium";
      state.finished = false;
      state.mistakes = 0;
      state.waitingDismissed = false;

      setBusy(true);
      await nextFrame();

      try {
        const diff = DIFFICULTIES[state.difficultyKey] || DIFFICULTIES.medium;
        const solution = generateSolvedBoard();
        const { puzzle, clues } = generatePuzzle(solution, diff.targetClues);

        state.solution = solution;
        state.puzzle = puzzle;
        state.current = deepCopyBoard(puzzle);
        state.fixed = puzzle.map((v) => v !== 0);
        state.clues = clues;

        const firstEmpty = state.current.findIndex((v) => v === 0);
        state.selectedIdx = firstEmpty >= 0 ? firstEmpty : 0;

        startTimer();
        renderAll();

        toast(`${diff.label} sudoku hazır. (İpucu sayısı: ${clues})`);
      } catch (err) {
        console.error(err);
        toast("Sudoku üretimi başarısız oldu. Tekrar deneyin.");
      } finally {
        setBusy(false);
        selectCell(state.selectedIdx, { focus: true });
      }
    };

    buildBoardUI();
    window.lucide?.createIcons?.();

    newGameEl.addEventListener("click", startNewGame);
    difficultyEl.addEventListener("change", startNewGame);
    eraseEl.addEventListener("click", eraseSelected);
    checkEl.addEventListener("click", checkBoard);
    padEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const num = Number(btn.dataset.num || 0);
      if (num >= 1 && num <= 9) placeNumber(num);
    });

    playAgainEl.addEventListener("click", () => {
      if (typeof finishDialogEl.close === "function") finishDialogEl.close();
      startNewGame();
    });

    closeDialogEl.addEventListener("click", () => {
      if (typeof finishDialogEl.close === "function") finishDialogEl.close();
    });

    waitingEl?.addEventListener("click", () => {
      if (state.busy || state.finished) return;
      state.waitingDismissed = true;
      updateWaiting();
    });

    waitingEl?.addEventListener("keydown", (e) => {
      if (state.busy || state.finished) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      state.waitingDismissed = true;
      updateWaiting();
    });

    document.addEventListener("keydown", (e) => {
      if (state.busy) return;
      const tag = (e.target && e.target.tagName ? String(e.target.tagName) : "").toLowerCase();
      if (tag === "select" || tag === "input" || tag === "textarea") return;

      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        placeNumber(Number(e.key));
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
        e.preventDefault();
        eraseSelected();
        return;
      }

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          moveSelection(-1, 0);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveSelection(1, 0);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveSelection(0, -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveSelection(0, 1);
          break;
        default:
          break;
      }
    });

    updateStats();
    updateControls();
    startNewGame();
  };

  init();
})();
