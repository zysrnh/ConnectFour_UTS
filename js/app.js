(function () {
  'use strict';

  const AI_LIB = window.ConnectFourAI;
  const { ROWS, COLS, EMPTY, HUMAN, AI, WIN_SCORE } = AI_LIB;

  const state = {
    view: 'menu', // 'menu' | 'game'
    gameMode: 'hvb', // 'hvb' | 'bvb'
    difficulty: 'Hard', // 'Easy' | 'Medium' | 'Hard' | 'Custom'
    firstPlayer: HUMAN, // 1 | 2
    board: AI_LIB.createBoard(),
    currentPlayer: HUMAN,
    gameOver: false,
    winner: null,
    winCells: [],
    lastMove: null,
    lastAiResult: null,
    moveCount: 0,
    moveLog: [],
    history: [],
    compareTarget: null,
    isThinking: false,
    autoPlayPaused: false,
    autoPlayTimer: null,
    pendingBotTimer: null,
    postGameTimer: null,
    hoverCol: -1,
  };

  const els = {
    // Views
    menuView: document.getElementById('menuView'),
    gameView: document.getElementById('gameView'),
    arenaShell: document.getElementById('arenaShell'),

    // Main Menu
    menuConfigBadge: document.getElementById('menuConfigBadge'),
    modeChoiceGrid: document.getElementById('modeChoiceGrid'),
    diffChoiceGrid: document.getElementById('diffChoiceGrid'),
    firstChoiceGrid: document.getElementById('firstChoiceGrid'),
    firstP1Hint: document.getElementById('firstP1Hint'),
    customConfigBox: document.getElementById('customConfigBox'),
    algorithmSelect: document.getElementById('algorithmSelect'),
    depthSelect: document.getElementById('depthSelect'),
    startGameBtn: document.getElementById('startGameBtn'),
    openInfoBtn: document.getElementById('openInfoBtn'),

    // Modal
    infoModal: document.getElementById('infoModal'),
    closeInfoBtn: document.getElementById('closeInfoBtn'),
    modalLegendList: document.getElementById('modalLegendList'),

    // Arena
    arenaPill: document.getElementById('arenaPill'),
    backMenuBtn: document.getElementById('backMenuBtn'),
    activeConfigBadge: document.getElementById('activeConfigBadge'),
    turnCounterBadge: document.getElementById('turnCounterBadge'),
    undoBtn: document.getElementById('undoBtn'),
    resetBtn: document.getElementById('resetBtn'),
    bvbBar: document.getElementById('bvbBar'),
    botStepBtn: document.getElementById('botStepBtn'),
    autoPlayBtn: document.getElementById('autoPlayBtn'),
    statusBanner: document.getElementById('statusBanner'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    thinkingDots: document.getElementById('thinkingDots'),
    lastMovePill: document.getElementById('lastMovePill'),
    hoverPreviewRow: document.getElementById('hoverPreviewRow'),
    colSelectors: document.getElementById('colSelectors'),
    boardGrid: document.getElementById('boardGrid'),
    p1LegendLabel: document.getElementById('p1LegendLabel'),
    p2LegendLabel: document.getElementById('p2LegendLabel'),

    // Post-Game Analysis
    postGamePanel: document.getElementById('postGamePanel'),
    postGameBanner: document.getElementById('postGameBanner'),
    postGameTitle: document.getElementById('postGameTitle'),
    postGameSub: document.getElementById('postGameSub'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    postMenuBtn: document.getElementById('postMenuBtn'),
    statTotalMoves: document.getElementById('statTotalMoves'),
    statBotMoves: document.getElementById('statBotMoves'),
    statAvgNodes: document.getElementById('statAvgNodes'),
    statTotalTime: document.getElementById('statTotalTime'),
    postGameTableBody: document.getElementById('postGameTableBody'),
    legendTotalBadge: document.getElementById('legendTotalBadge'),
    heuristicGrid: document.getElementById('heuristicGrid'),
    compareDepthSelect: document.getElementById('compareDepthSelect'),
    compareBtn: document.getElementById('compareBtn'),
    compareContextText: document.getElementById('compareContextText'),
    compareResult: document.getElementById('compareResult'),
  };

  function getAiConfig() {
    if (state.difficulty === 'Easy') {
      return { difficulty: 'Easy', usePruning: false, maxDepth: 0, label: 'Easy • Random' };
    }
    if (state.difficulty === 'Medium') {
      return { difficulty: 'Medium', usePruning: false, maxDepth: 3, label: 'Medium • Minimax d=3' };
    }
    if (state.difficulty === 'Hard') {
      return { difficulty: 'Hard', usePruning: true, maxDepth: 5, label: 'Hard • Alpha-Beta d=5' };
    }
    const usePruning = els.algorithmSelect.value === 'alphabeta';
    const maxDepth = Number(els.depthSelect.value);
    const algoTxt = usePruning ? 'Alpha-Beta' : 'Minimax';
    return {
      difficulty: 'Custom',
      usePruning,
      maxDepth,
      label: `Custom • ${algoTxt} d=${maxDepth}`,
    };
  }

  function formatScore(score) {
    if (score === null || score === undefined) return '-';
    if (score >= WIN_SCORE - 100) return `+${score} (Win)`;
    if (score <= -(WIN_SCORE - 100)) return `${score} (Lose)`;
    return score > 0 ? `+${score}` : `${score}`;
  }

  function syncMenuUI() {
    els.modeChoiceGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === state.gameMode);
    });
    els.diffChoiceGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.diff === state.difficulty);
    });
    els.firstChoiceGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.first) === state.firstPlayer);
    });

    els.firstP1Hint.textContent =
      state.gameMode === 'bvb' ? 'Bot Coral (Depth 3) jalan pertama' : 'Manusia jalan pertama';
    els.customConfigBox.style.display = state.difficulty === 'Custom' ? 'block' : 'none';

    const cfg = getAiConfig();
    els.menuConfigBadge.textContent = cfg.label;
    els.activeConfigBadge.textContent = cfg.label;
  }

  function clearTimers() {
    if (state.pendingBotTimer) {
      clearTimeout(state.pendingBotTimer);
      state.pendingBotTimer = null;
    }
    if (state.autoPlayTimer) {
      clearInterval(state.autoPlayTimer);
      state.autoPlayTimer = null;
    }
    if (state.postGameTimer) {
      clearTimeout(state.postGameTimer);
      state.postGameTimer = null;
    }
    state.isThinking = false;
  }

  function switchView(viewName) {
    state.view = viewName;
    els.menuView.style.display = viewName === 'menu' ? 'block' : 'none';
    els.gameView.style.display = viewName === 'game' ? 'block' : 'none';
  }

  function renderScoringLegend(targetEl, info, winner) {
    function renderMiniTiles(dots) {
      return (
        '<span class="mini-tiles">' +
        dots.map((d) => `<span class="mini-tile"><span class="mini-dot ${d}"></span></span>`).join('') +
        '</span>'
      );
    }

    const rows = [
      {
        dots: ['ai', 'ai', 'ai', 'ai'],
        label: '4-in-a-Row AI',
        count: winner === AI ? 'Menang' : info ? '0x' : 'Terminal',
        pts: '+100000',
      },
      {
        dots: ['ai', 'ai', 'ai', 'empty'],
        label: '3 AI + 1 Kosong',
        count: info ? `${info.aiThree}x` : 'per pola',
        pts: '+12',
      },
      {
        dots: ['ai', 'ai', 'empty', 'empty'],
        label: '2 AI + 2 Kosong',
        count: info ? `${info.aiTwo}x` : 'per pola',
        pts: '+3',
      },
      {
        dots: ['opp', 'opp', 'opp', 'empty'],
        label: 'Ancaman 3 Lawan',
        count: info ? `${info.oppThree}x` : 'per pola',
        pts: '-80',
      },
      {
        dots: ['opp', 'opp', 'empty', 'empty'],
        label: '2 Lawan + 2 Kosong',
        count: info ? `${info.oppTwo}x` : 'per pola',
        pts: '-2',
      },
      {
        dots: ['center'],
        label: 'Kontrol Kolom Tengah',
        count: info ? `AI ${info.centerAi}:${info.centerOpp}` : 'per selisih',
        pts: info ? `${info.centerScore >= 0 ? '+' : ''}${info.centerScore}` : '+4',
      },
    ];

    targetEl.innerHTML = '';
    rows.forEach((row) => {
      const el = document.createElement('div');
      el.className = 'legend-score-row';
      el.innerHTML = `
        <div class="legend-pattern">
          ${renderMiniTiles(row.dots)}
          <span>${row.label}</span>
        </div>
        <div class="legend-right">
          <span class="legend-live-count">${row.count}</span>
          <span class="legend-points">${row.pts}</span>
        </div>
      `;
      targetEl.appendChild(el);
    });
  }

  function getWinningIndex(r, c) {
    for (let i = 0; i < state.winCells.length; i++) {
      if (state.winCells[i][0] === r && state.winCells[i][1] === c) return i;
    }
    return -1;
  }

  function saveSnapshot() {
    state.history.push({
      board: AI_LIB.cloneBoard(state.board),
      currentPlayer: state.currentPlayer,
      gameOver: state.gameOver,
      winner: state.winner,
      winCells: state.winCells.slice(),
      lastMove: state.lastMove ? { ...state.lastMove } : null,
      lastAiResult: state.lastAiResult ? { ...state.lastAiResult, columnScores: { ...state.lastAiResult.columnScores } } : null,
      moveCount: state.moveCount,
      moveLog: state.moveLog.slice(),
      compareTarget: state.compareTarget
        ? { board: AI_LIB.cloneBoard(state.compareTarget.board), aiPiece: state.compareTarget.aiPiece, step: state.compareTarget.step }
        : null,
    });
  }

  function restoreSnapshot(snap) {
    state.board = AI_LIB.cloneBoard(snap.board);
    state.currentPlayer = snap.currentPlayer;
    state.gameOver = snap.gameOver;
    state.winner = snap.winner;
    state.winCells = snap.winCells.slice();
    state.lastMove = snap.lastMove ? { ...snap.lastMove } : null;
    state.lastAiResult = snap.lastAiResult;
    state.moveCount = snap.moveCount;
    state.moveLog = snap.moveLog.slice();
    state.compareTarget = snap.compareTarget
      ? { board: AI_LIB.cloneBoard(snap.compareTarget.board), aiPiece: snap.compareTarget.aiPiece, step: snap.compareTarget.step }
      : null;
  }

  function renderBoard() {
    const isBvb = state.gameMode === 'bvb';
    const humanCanClick = !state.gameOver && !state.isThinking && !isBvb && state.currentPlayer === HUMAN;

    // Ghost Hover Preview Row
    els.hoverPreviewRow.innerHTML = '';
    for (let c = 0; c < COLS; c++) {
      const slot = document.createElement('div');
      slot.className = 'ghost-slot';
      const ghost = document.createElement('div');
      ghost.className = 'ghost-disc';
      ghost.dataset.col = String(c);
      slot.appendChild(ghost);
      els.hoverPreviewRow.appendChild(slot);
    }

    // Column selector buttons
    els.colSelectors.innerHTML = '';
    for (let c = 0; c < COLS; c++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'col-btn';
      const valid = AI_LIB.isValidLocation(state.board, c);
      if (state.lastAiResult && state.lastAiResult.bestCol === c) {
        btn.classList.add('col-best');
      }
      btn.disabled = !humanCanClick || !valid;
      btn.textContent = `K${c}`;
      btn.title = `Jatuhkan bidak ke Kolom ${c}`;
      btn.addEventListener('mouseenter', () => setHoverCol(c));
      btn.addEventListener('mouseleave', () => setHoverCol(-1));
      btn.addEventListener('click', () => handleHumanMove(c));
      els.colSelectors.appendChild(btn);
    }

    // 6x7 Grid
    els.boardGrid.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);

        if (!humanCanClick || !AI_LIB.isValidLocation(state.board, c)) {
          cell.classList.add('disabled');
        }
        if (state.lastMove && state.lastMove.row === r && state.lastMove.col === c) {
          cell.classList.add('last-move');
        }
        const winIdx = getWinningIndex(r, c);
        if (winIdx !== -1) {
          cell.classList.add('win-cell');
          cell.style.setProperty('--win-idx', String(winIdx));
        }

        const val = state.board[r][c];
        if (val !== EMPTY) {
          const disc = document.createElement('div');
          disc.className = `disc ${val === HUMAN ? 'p1' : 'p2'}`;
          if (state.lastMove && state.lastMove.row === r && state.lastMove.col === c && state.lastMove.animate) {
            disc.classList.add('drop-anim');
            disc.style.setProperty('--drop-rows', String(r + 1));
          }
          cell.appendChild(disc);
        }

        cell.addEventListener('mouseenter', () => setHoverCol(c));
        cell.addEventListener('mouseleave', () => setHoverCol(-1));
        cell.addEventListener('click', () => {
          if (humanCanClick) handleHumanMove(c);
        });
        els.boardGrid.appendChild(cell);
      }
    }

    if (state.lastMove) {
      state.lastMove.animate = false;
    }
    applyHoverVisuals();
  }

  function applyHoverVisuals() {
    const isBvb = state.gameMode === 'bvb';
    const humanCanClick = !state.gameOver && !state.isThinking && !isBvb && state.currentPlayer === HUMAN;
    const col = state.hoverCol;
    const landingRow =
      humanCanClick && col >= 0 && AI_LIB.isValidLocation(state.board, col)
        ? AI_LIB.getNextOpenRow(state.board, col)
        : -1;

    els.hoverPreviewRow.querySelectorAll('.ghost-disc').forEach((g, idx) => {
      g.classList.toggle('visible', idx === col && landingRow !== -1);
    });

    els.colSelectors.querySelectorAll('.col-btn').forEach((btn, idx) => {
      btn.classList.toggle('col-hover', idx === col && landingRow !== -1);
    });

    els.boardGrid.querySelectorAll('.cell').forEach((cell) => {
      const r = Number(cell.dataset.row);
      const c = Number(cell.dataset.col);
      const isColHover = c === col && landingRow !== -1 && state.board[r][c] === EMPTY;
      cell.classList.toggle('col-active-hover', isColHover && r !== landingRow);
      cell.classList.toggle('target-landing', isColHover && r === landingRow);
    });
  }

  function setHoverCol(col) {
    if (state.hoverCol === col) return;
    state.hoverCol = col;
    applyHoverVisuals();
  }

  function renderArenaHeaderAndStatus() {
    const isBvb = state.gameMode === 'bvb';
    els.arenaPill.textContent = isBvb ? 'DEMO BOT VS BOT • TIM 12' : 'ARENA PERMAINAN • TIM 12';
    els.p1LegendLabel.textContent = isBvb ? 'Pemain 1: Bot Coral (Depth 3)' : 'Pemain 1: Manusia (MIN • Coral)';
    els.p2LegendLabel.textContent = isBvb ? 'Pemain 2: Bot Kuning (Konfigurasi Aktif)' : 'Pemain 2: Bot AI (MAX • Kuning)';

    els.bvbBar.style.display = isBvb && !state.gameOver ? 'flex' : 'none';
    els.autoPlayBtn.textContent = state.autoPlayPaused ? 'Lanjut Auto-Play' : 'Jeda Auto-Play';

    els.turnCounterBadge.textContent = `Langkah #${state.moveCount}`;
    els.undoBtn.disabled = state.history.length === 0 || state.isThinking;

    if (state.lastAiResult) {
      els.lastMovePill.textContent = `Bot → Kol ${state.lastAiResult.bestCol} (eval ${formatScore(state.lastAiResult.bestScore)})`;
    } else if (state.lastMove) {
      els.lastMovePill.textContent = `Terakhir → Kol ${state.lastMove.col}`;
    } else {
      els.lastMovePill.textContent = 'Siap Main';
    }

    els.statusBanner.className = 'status-banner';
    els.statusDot.className = 'status-dot';
    els.thinkingDots.classList.remove('active');

    if (state.gameOver) {
      if (state.winner === 'DRAW') {
        els.statusBanner.classList.add('game-draw');
        els.statusDot.classList.add('neutral');
        els.statusText.textContent = 'Permainan Berakhir SERI (Papan Penuh)';
      } else {
        els.statusBanner.classList.add('game-win');
        els.statusDot.classList.add(state.winner === HUMAN ? 'p1' : 'p2');
        if (isBvb) {
          els.statusText.textContent =
            state.winner === HUMAN ? 'Bot Coral (Pemain 1) MENANG!' : 'Bot Kuning (Pemain 2) MENANG!';
        } else {
          els.statusText.textContent =
            state.winner === HUMAN ? 'Selamat! Manusia (Coral) MENANG!' : 'Bot AI (Kuning) MENANG!';
        }
      }
      return;
    }

    if (state.isThinking) {
      els.statusBanner.classList.add(state.currentPlayer === HUMAN ? 'turn-p1' : 'turn-p2');
      els.statusDot.classList.add(state.currentPlayer === HUMAN ? 'p1' : 'p2');
      els.statusText.textContent = 'Bot AI sedang mengevaluasi Game Tree';
      els.thinkingDots.classList.add('active');
      return;
    }

    if (state.currentPlayer === HUMAN) {
      els.statusBanner.classList.add('turn-p1');
      els.statusDot.classList.add('p1');
      els.statusText.textContent = isBvb
        ? 'Giliran Bot Coral...'
        : 'Giliran Anda (Coral) — Pilih Kolom 0–6';
    } else {
      els.statusBanner.classList.add('turn-p2');
      els.statusDot.classList.add('p2');
      els.statusText.textContent = isBvb
        ? 'Giliran Bot Kuning...'
        : 'Giliran Bot AI (Kuning)...';
    }
  }

  function renderPostGameAnalysis(showPanel) {
    if (!showPanel || !state.gameOver) {
      els.arenaShell.classList.remove('has-analysis');
      els.postGamePanel.style.display = 'none';
      return;
    }

    els.arenaShell.classList.add('has-analysis');
    els.postGamePanel.style.display = 'block';

    const isBvb = state.gameMode === 'bvb';
    els.postGameBanner.className = 'postgame-banner';
    if (state.winner === 'DRAW') {
      els.postGameBanner.classList.add('is-draw');
      els.postGameTitle.textContent = 'Hasil Akhir: SERI!';
      els.postGameSub.textContent = `Papan penuh setelah ${state.moveCount} langkah tanpa 4-in-a-row.`;
    } else if (state.winner === HUMAN) {
      els.postGameTitle.textContent = isBvb ? 'Bot Coral (Pemain 1) Menang!' : 'Selamat, Anda Menang!';
      els.postGameSub.textContent = `4 bidak terhubung dalam total ${state.moveCount} langkah permainan.`;
    } else {
      els.postGameBanner.classList.add('is-bot-win');
      els.postGameTitle.textContent = isBvb ? 'Bot Kuning (Pemain 2) Menang!' : 'Bot AI (Kuning) Menang!';
      els.postGameSub.textContent = `Bot AI mengunci kemenangan pada langkah ke-${state.moveCount}.`;
    }

    const botEntries = state.moveLog.filter((m) => m.isBot);
    const totalNodes = botEntries.reduce((acc, m) => acc + m.nodes, 0);
    const totalTime = botEntries.reduce((acc, m) => acc + m.elapsedMs, 0);
    const avgNodes = botEntries.length > 0 ? Math.round(totalNodes / botEntries.length) : 0;

    els.statTotalMoves.textContent = String(state.moveCount);
    els.statBotMoves.textContent = String(botEntries.length);
    els.statAvgNodes.textContent = avgNodes.toLocaleString('id-ID');
    els.statTotalTime.textContent = `${totalTime.toFixed(1)} ms`;

    // Render step-by-step table
    els.postGameTableBody.innerHTML = '';
    state.moveLog.forEach((entry, idx) => {
      const tr = document.createElement('tr');
      if (entry.isBot) tr.classList.add('row-bot');
      if (idx === state.moveLog.length - 1 && state.winner !== 'DRAW') tr.classList.add('row-win');
      tr.innerHTML = `
        <td>#${entry.step}</td>
        <td>${entry.actor}</td>
        <td>Kol ${entry.col} (R${entry.row})</td>
        <td>${entry.scoreText}</td>
        <td>${entry.isBot ? entry.nodes.toLocaleString('id-ID') : '-'}</td>
        <td>${entry.isBot ? `${entry.elapsedMs} ms` : '-'}</td>
      `;
      els.postGameTableBody.appendChild(tr);
    });

    // Final Scoring Legend
    const finalInfo = AI_LIB.analyzeBoard(state.board, AI);
    els.legendTotalBadge.textContent = `Total: ${formatScore(finalInfo.totalScore)}`;
    renderScoringLegend(els.heuristicGrid, finalInfo, state.winner);

    if (state.compareTarget) {
      els.compareContextText.textContent =
        `Menguji posisi papan aktif pada langkah #${state.compareTarget.step} (sebelum langkah penutup) untuk membandingkan efisiensi pruning.`;
    }
  }

  function renderAll(showPostGameNow = false) {
    renderArenaHeaderAndStatus();
    renderBoard();
    renderPostGameAnalysis(state.gameOver && showPostGameNow);
  }

  function executeDrop(col, player, aiResult) {
    const row = AI_LIB.getNextOpenRow(state.board, col);
    if (row === -1) return false;

    const preMoveBoard = AI_LIB.cloneBoard(state.board);
    saveSnapshot();
    AI_LIB.dropPiece(state.board, row, col, player);
    state.moveCount += 1;
    state.lastMove = { row, col, animate: true };

    if (aiResult) {
      state.lastAiResult = aiResult;
    }

    // Simpan posisi papan non-terminal terakhir untuk benchmark post-game
    state.compareTarget = {
      board: preMoveBoard,
      aiPiece: player === HUMAN && state.gameMode === 'hvb' ? AI : player,
      step: state.moveCount,
    };

    const isBvb = state.gameMode === 'bvb';
    const isBot = isBvb || player === AI;
    const actor =
      player === HUMAN ? (isBvb ? 'Bot Coral' : 'Manusia') : isBvb ? 'Bot Kuning' : 'Bot AI';

    const scoreText = aiResult
      ? formatScore(aiResult.bestScore)
      : formatScore(AI_LIB.evaluateBoard(state.board, AI));

    state.moveLog.push({
      step: state.moveCount,
      actor,
      col,
      row,
      isBot,
      scoreText,
      nodes: aiResult ? aiResult.nodes : 0,
      elapsedMs: aiResult ? aiResult.elapsedMs : 0,
    });

    const winInfo = AI_LIB.getWinnerInfo(state.board);
    if (winInfo.winner !== null) {
      state.gameOver = true;
      state.winner = winInfo.winner;
      state.winCells = winInfo.cells;
      clearTimers();
      renderAll(false);
      // Tampilkan panel analisis setelah animasi bidak terakhir mendarat
      state.postGameTimer = setTimeout(() => {
        state.postGameTimer = null;
        renderPostGameAnalysis(true);
      }, 360);
      return true;
    }

    state.currentPlayer = player === HUMAN ? AI : HUMAN;
    renderAll(false);
    return true;
  }

  function handleHumanMove(col) {
    if (state.view !== 'game' || state.gameOver || state.isThinking) return;
    if (state.gameMode !== 'hvb' || state.currentPlayer !== HUMAN) return;
    if (!AI_LIB.isValidLocation(state.board, col)) return;

    const moved = executeDrop(col, HUMAN, null);
    if (moved && !state.gameOver) {
      scheduleBotTurn();
    }
  }

  function scheduleBotTurn() {
    state.isThinking = true;
    renderArenaHeaderAndStatus();
    applyHoverVisuals();

    state.pendingBotTimer = setTimeout(() => {
      state.pendingBotTimer = null;
      if (state.gameOver) {
        state.isThinking = false;
        renderArenaHeaderAndStatus();
        return;
      }
      state.isThinking = false;
      runSingleBotStep();
    }, 90);
  }

  function runSingleBotStep() {
    if (state.gameOver) return;
    const isBvb = state.gameMode === 'bvb';
    const piece = state.currentPlayer;

    let res;
    if (isBvb && piece === HUMAN) {
      res = AI_LIB.chooseMove(state.board, {
        difficulty: 'Medium',
        aiPiece: HUMAN,
        usePruning: false,
        customDepth: 3,
      });
    } else {
      const cfg = getAiConfig();
      res = AI_LIB.chooseMove(state.board, {
        difficulty: cfg.difficulty,
        aiPiece: piece,
        usePruning: cfg.usePruning,
        customDepth: cfg.difficulty === 'Custom' ? cfg.maxDepth : undefined,
      });
    }

    if (res.bestCol !== -1) {
      executeDrop(res.bestCol, piece, res);
    }
  }

  function startAutoPlayLoop() {
    if (state.gameMode !== 'bvb' || state.gameOver) return;
    if (state.autoPlayTimer) clearInterval(state.autoPlayTimer);
    state.autoPlayPaused = false;
    renderArenaHeaderAndStatus();

    state.autoPlayTimer = setInterval(() => {
      if (state.gameOver || state.autoPlayPaused) {
        clearInterval(state.autoPlayTimer);
        state.autoPlayTimer = null;
        return;
      }
      runSingleBotStep();
    }, 520);
  }

  function resetGame() {
    clearTimers();
    state.board = AI_LIB.createBoard();
    state.currentPlayer = state.firstPlayer;
    state.gameOver = false;
    state.winner = null;
    state.winCells = [];
    state.lastMove = null;
    state.lastAiResult = null;
    state.moveCount = 0;
    state.moveLog = [];
    state.history = [];
    state.compareTarget = null;
    state.hoverCol = -1;
    state.autoPlayPaused = false;

    els.compareResult.innerHTML =
      'Klik <strong>Bandingkan Node</strong> untuk melihat perbandingan jumlah node Minimax Murni vs Alpha-Beta Pruning.';

    renderAll(false);

    if (state.gameMode === 'bvb') {
      startAutoPlayLoop();
    } else if (state.currentPlayer === AI) {
      scheduleBotTurn();
    }
  }

  function startNewMatchFromMenu() {
    syncMenuUI();
    switchView('game');
    resetGame();
  }

  function goToMenu() {
    clearTimers();
    switchView('menu');
  }

  function undoMove() {
    if (state.history.length === 0 || state.isThinking) return;
    clearTimers();

    if (state.gameMode === 'hvb') {
      let targetIdx = state.history.length - 1;
      while (targetIdx > 0 && state.history[targetIdx].currentPlayer !== HUMAN) {
        targetIdx--;
      }
      const snap = state.history[targetIdx];
      state.history = state.history.slice(0, targetIdx);
      restoreSnapshot(snap);
      renderAll(false);
      if (state.currentPlayer === AI && !state.gameOver) {
        scheduleBotTurn();
      }
    } else {
      state.autoPlayPaused = true;
      const snap = state.history.pop();
      restoreSnapshot(snap);
      renderAll(false);
    }
  }

  function toggleAutoPlay() {
    if (state.gameMode !== 'bvb' || state.gameOver) return;
    if (state.autoPlayPaused) {
      startAutoPlayLoop();
    } else {
      state.autoPlayPaused = true;
      if (state.autoPlayTimer) {
        clearInterval(state.autoPlayTimer);
        state.autoPlayTimer = null;
      }
      renderArenaHeaderAndStatus();
    }
  }

  function runPostGameComparison() {
    const target = state.compareTarget;
    if (!target) return;
    const depth = Number(els.compareDepthSelect.value);
    const comp = AI_LIB.compareAlgorithms(target.board, depth, target.aiPiece);

    els.compareResult.innerHTML = `
      <table class="compare-table">
        <thead>
          <tr>
            <th>Algoritma (Depth ${comp.maxDepth})</th>
            <th>Kolom</th>
            <th>Skor Eval</th>
            <th>Node</th>
            <th>Waktu</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Depth-Limited Minimax</td>
            <td>Kol ${comp.pureMinimax.bestCol}</td>
            <td>${formatScore(comp.pureMinimax.bestScore)}</td>
            <td>${comp.pureMinimax.nodes.toLocaleString('id-ID')}</td>
            <td>${comp.pureMinimax.elapsedMs} ms</td>
          </tr>
          <tr>
            <td>Alpha-Beta Pruning</td>
            <td>Kol ${comp.alphaBeta.bestCol}</td>
            <td>${formatScore(comp.alphaBeta.bestScore)}</td>
            <td>${comp.alphaBeta.nodes.toLocaleString('id-ID')}</td>
            <td>${comp.alphaBeta.elapsedMs} ms</td>
          </tr>
        </tbody>
      </table>
      <div class="compare-summary">
        Alpha-Beta memangkas <strong>${comp.reductionPct}%</strong> node pencarian (${(comp.pureMinimax.nodes - comp.alphaBeta.nodes).toLocaleString('id-ID')} node dihemat) dengan keputusan ${comp.sameDecision ? '100% IDENTIK' : 'berbeda'}.
      </div>
    `;
  }

  function bindEvents() {
    els.modeChoiceGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      state.gameMode = btn.dataset.mode;
      syncMenuUI();
    });

    els.diffChoiceGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      state.difficulty = btn.dataset.diff;
      syncMenuUI();
    });

    els.firstChoiceGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      state.firstPlayer = Number(btn.dataset.first);
      syncMenuUI();
    });

    els.algorithmSelect.addEventListener('change', syncMenuUI);
    els.depthSelect.addEventListener('change', syncMenuUI);

    els.startGameBtn.addEventListener('click', startNewMatchFromMenu);
    els.backMenuBtn.addEventListener('click', goToMenu);
    els.postMenuBtn.addEventListener('click', goToMenu);
    els.playAgainBtn.addEventListener('click', resetGame);
    els.resetBtn.addEventListener('click', resetGame);
    els.undoBtn.addEventListener('click', undoMove);

    els.botStepBtn.addEventListener('click', () => {
      if (state.gameMode === 'bvb' && !state.gameOver) {
        state.autoPlayPaused = true;
        if (state.autoPlayTimer) {
          clearInterval(state.autoPlayTimer);
          state.autoPlayTimer = null;
        }
        runSingleBotStep();
      }
    });
    els.autoPlayBtn.addEventListener('click', toggleAutoPlay);
    els.compareBtn.addEventListener('click', runPostGameComparison);

    els.openInfoBtn.addEventListener('click', () => {
      renderScoringLegend(els.modalLegendList, null, null);
      els.infoModal.style.display = 'flex';
    });
    els.closeInfoBtn.addEventListener('click', () => {
      els.infoModal.style.display = 'none';
    });
    els.infoModal.addEventListener('click', (e) => {
      if (e.target === els.infoModal) {
        els.infoModal.style.display = 'none';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.infoModal.style.display === 'flex') {
        els.infoModal.style.display = 'none';
        return;
      }
      if (state.view !== 'game' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
      if (e.key >= '0' && e.key <= '6') {
        handleHumanMove(Number(e.key));
      }
    });
  }

  syncMenuUI();
  bindEvents();
  switchView('menu');
})();
