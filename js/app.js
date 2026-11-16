(function () {
  'use strict';

  const AI_LIB = window.ConnectFourAI;
  const { ROWS, COLS, EMPTY, HUMAN, AI, WIN_SCORE } = AI_LIB;

  const state = {
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
    isThinking: false,
    autoPlayTimer: null,
    pendingBotTimer: null,
    hoverCol: -1,
  };

  const els = {
    turnCounterBadge: document.getElementById('turnCounterBadge'),
    statusBanner: document.getElementById('statusBanner'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    staticEvalBadge: document.getElementById('staticEvalBadge'),
    colSelectors: document.getElementById('colSelectors'),
    boardGrid: document.getElementById('boardGrid'),
    p1LegendLabel: document.getElementById('p1LegendLabel'),
    p2LegendLabel: document.getElementById('p2LegendLabel'),
    activeConfigBadge: document.getElementById('activeConfigBadge'),
    gameModeSelect: document.getElementById('gameModeSelect'),
    difficultySelect: document.getElementById('difficultySelect'),
    algorithmSelect: document.getElementById('algorithmSelect'),
    depthSelect: document.getElementById('depthSelect'),
    firstPlayerSelect: document.getElementById('firstPlayerSelect'),
    compareDepthSelect: document.getElementById('compareDepthSelect'),
    resetBtn: document.getElementById('resetBtn'),
    undoBtn: document.getElementById('undoBtn'),
    botStepBtn: document.getElementById('botStepBtn'),
    autoPlayBtn: document.getElementById('autoPlayBtn'),
    algoBadge: document.getElementById('algoBadge'),
    metricBestCol: document.getElementById('metricBestCol'),
    metricBestScore: document.getElementById('metricBestScore'),
    metricNodes: document.getElementById('metricNodes'),
    metricTime: document.getElementById('metricTime'),
    colScoresList: document.getElementById('colScoresList'),
    heuristicGrid: document.getElementById('heuristicGrid'),
    legendTotalBadge: document.getElementById('legendTotalBadge'),
    compareBtn: document.getElementById('compareBtn'),
    compareResult: document.getElementById('compareResult'),
    moveLog: document.getElementById('moveLog'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),
  };

  function getAiConfig() {
    const difficulty = els.difficultySelect.value;
    if (difficulty === 'Easy') {
      return { difficulty: 'Easy', usePruning: false, maxDepth: 0 };
    }
    if (difficulty === 'Medium') {
      return { difficulty: 'Medium', usePruning: false, maxDepth: 3 };
    }
    if (difficulty === 'Hard') {
      return { difficulty: 'Hard', usePruning: true, maxDepth: 5 };
    }
    return {
      difficulty: 'Custom',
      usePruning: els.algorithmSelect.value === 'alphabeta',
      maxDepth: Number(els.depthSelect.value),
    };
  }

  function syncControlsWithDifficulty() {
    const diff = els.difficultySelect.value;
    if (diff === 'Easy') {
      els.algorithmSelect.disabled = true;
      els.depthSelect.disabled = true;
      els.activeConfigBadge.textContent = 'Easy • Random Move';
    } else if (diff === 'Medium') {
      els.algorithmSelect.disabled = false;
      els.depthSelect.disabled = false;
      els.algorithmSelect.value = 'minimax';
      els.depthSelect.value = '3';
      els.activeConfigBadge.textContent = 'Medium • Minimax • Depth 3';
    } else if (diff === 'Hard') {
      els.algorithmSelect.disabled = false;
      els.depthSelect.disabled = false;
      els.algorithmSelect.value = 'alphabeta';
      els.depthSelect.value = '5';
      els.activeConfigBadge.textContent = 'Hard • Alpha-Beta • Depth 5';
    } else {
      els.algorithmSelect.disabled = false;
      els.depthSelect.disabled = false;
      const algoLabel = els.algorithmSelect.value === 'alphabeta' ? 'Alpha-Beta' : 'Minimax';
      els.activeConfigBadge.textContent = `Custom • ${algoLabel} • Depth ${els.depthSelect.value}`;
    }
  }

  function clearTimers() {
    if (state.pendingBotTimer) {
      clearTimeout(state.pendingBotTimer);
      state.pendingBotTimer = null;
    }
    if (state.autoPlayTimer) {
      clearInterval(state.autoPlayTimer);
      state.autoPlayTimer = null;
      els.autoPlayBtn.textContent = 'Auto-Play Bot vs Bot';
    }
    state.isThinking = false;
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
  }

  function formatScore(score) {
    if (score === null || score === undefined) return 'Penuh';
    if (score >= WIN_SCORE - 100) return `+${score} (Win)`;
    if (score <= -(WIN_SCORE - 100)) return `${score} (Lose)`;
    return score > 0 ? `+${score}` : `${score}`;
  }

  function isWinningCell(r, c) {
    for (let i = 0; i < state.winCells.length; i++) {
      if (state.winCells[i][0] === r && state.winCells[i][1] === c) return true;
    }
    return false;
  }

  function updateLegendAndModeButtons() {
    const isBvb = els.gameModeSelect.value === 'bvb';
    els.p1LegendLabel.textContent = isBvb ? 'Pemain 1: Bot Coral (Depth 3)' : 'Pemain 1: Manusia (MIN • Coral)';
    els.p2LegendLabel.textContent = isBvb ? 'Pemain 2: Bot Kuning (Konfigurasi Aktif)' : 'Pemain 2: Bot AI (MAX • Kuning)';
    els.botStepBtn.style.display = isBvb ? 'inline-flex' : 'none';
    els.autoPlayBtn.style.display = isBvb ? 'inline-flex' : 'none';
  }

  function renderBoard() {
    const isBvb = els.gameModeSelect.value === 'bvb';
    const humanCanClick = !state.gameOver && !state.isThinking && !isBvb && state.currentPlayer === HUMAN;

    // Column selector buttons
    els.colSelectors.innerHTML = '';
    for (let c = 0; c < COLS; c++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'col-btn';
      const valid = AI_LIB.isValidLocation(state.board, c);
      if (state.hoverCol === c && valid && humanCanClick) {
        btn.classList.add('col-hover');
      }
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
        if (!humanCanClick || !AI_LIB.isValidLocation(state.board, c)) {
          cell.classList.add('disabled');
        }
        if (state.hoverCol === c && state.board[r][c] === EMPTY && humanCanClick && AI_LIB.isValidLocation(state.board, c)) {
          cell.classList.add('col-active-hover');
        }
        if (state.lastMove && state.lastMove.row === r && state.lastMove.col === c) {
          cell.classList.add('last-move');
        }
        if (isWinningCell(r, c)) {
          cell.classList.add('win-cell');
        }

        const val = state.board[r][c];
        if (val !== EMPTY) {
          const disc = document.createElement('div');
          disc.className = `disc ${val === HUMAN ? 'p1' : 'p2'}`;
          if (state.lastMove && state.lastMove.row === r && state.lastMove.col === c && state.lastMove.animate) {
            disc.classList.add('drop-anim');
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
  }

  function setHoverCol(col) {
    if (state.hoverCol === col) return;
    state.hoverCol = col;
    const cols = els.colSelectors.querySelectorAll('.col-btn');
    cols.forEach((btn, idx) => {
      btn.classList.toggle('col-hover', idx === col && !btn.disabled);
    });
    const cells = els.boardGrid.querySelectorAll('.cell');
    cells.forEach((cell, idx) => {
      const r = Math.floor(idx / COLS);
      const c = idx % COLS;
      const isClickable = !cell.classList.contains('disabled');
      cell.classList.toggle('col-active-hover', c === col && state.board[r][c] === EMPTY && isClickable);
    });
  }

  function renderStatus() {
    els.turnCounterBadge.textContent = `Langkah #${state.moveCount}`;
    const staticAnalysis = AI_LIB.analyzeBoard(state.board, AI);
    els.staticEvalBadge.textContent = `Eval Papan (AI): ${formatScore(staticAnalysis.totalScore)}`;

    const isBvb = els.gameModeSelect.value === 'bvb';
    els.statusBanner.className = 'status-banner';
    els.statusDot.className = 'status-dot';

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
      els.statusText.textContent = 'Bot AI sedang mengevaluasi Game Tree...';
      return;
    }

    if (state.currentPlayer === HUMAN) {
      els.statusBanner.classList.add('turn-p1');
      els.statusDot.classList.add('p1');
      els.statusText.textContent = isBvb
        ? 'Giliran Bot Coral (Klik 1 Langkah atau Auto-Play)'
        : 'Giliran Anda (Coral) — Pilih Kolom 0–6';
    } else {
      els.statusBanner.classList.add('turn-p2');
      els.statusDot.classList.add('p2');
      els.statusText.textContent = isBvb
        ? 'Giliran Bot Kuning (Klik 1 Langkah atau Auto-Play)'
        : 'Giliran Bot AI (Kuning)...';
    }
  }

  function renderInspector() {
    const res = state.lastAiResult;
    if (!res) {
      els.algoBadge.textContent = 'Menunggu langkah Bot';
      els.metricBestCol.textContent = '-';
      els.metricBestScore.textContent = '-';
      els.metricBestScore.className = 'metric-value';
      els.metricNodes.textContent = '-';
      els.metricTime.textContent = '-';
    } else {
      const algoName = res.isRandom
        ? 'Random Move (Easy)'
        : `${res.usePruning ? 'Alpha-Beta Pruning' : 'Minimax Murni'} • Depth ${res.maxDepth}`;
      els.algoBadge.textContent = algoName;
      els.metricBestCol.textContent = `Kol ${res.bestCol}`;
      els.metricBestScore.textContent = formatScore(res.bestScore);
      els.metricBestScore.className =
        'metric-value ' + (res.bestScore > 0 ? 'positive' : res.bestScore < 0 ? 'negative' : '');
      els.metricNodes.textContent = res.nodes.toLocaleString('id-ID');
      els.metricTime.textContent = `${res.elapsedMs} ms`;
    }

    // Column Scores (0..6)
    els.colScoresList.innerHTML = '';
    const scores = res ? res.columnScores : null;
    let maxAbs = 10;
    if (scores) {
      for (let c = 0; c < COLS; c++) {
        if (scores[c] !== null && scores[c] !== undefined) {
          const capped = Math.min(Math.abs(scores[c]), 200);
          if (capped > maxAbs) maxAbs = capped;
        }
      }
    }

    for (let c = 0; c < COLS; c++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'col-score-row';
      const val = scores ? scores[c] : null;
      const isChosen = res && res.bestCol === c;
      if (isChosen) rowEl.classList.add('is-chosen');
      if (scores && (val === null || val === undefined)) rowEl.classList.add('is-full');

      const labelEl = document.createElement('span');
      labelEl.textContent = `Kol ${c}${isChosen ? ' ★' : ''}`;

      const trackEl = document.createElement('div');
      trackEl.className = 'score-bar-track';
      if (val !== null && val !== undefined) {
        const fillEl = document.createElement('div');
        fillEl.className = `score-bar-fill ${val >= 0 ? 'pos' : 'neg'}`;
        const pct = Math.abs(val) >= WIN_SCORE - 100 ? 100 : Math.min(100, Math.max(4, (Math.abs(val) / maxAbs) * 100));
        fillEl.style.width = `${pct}%`;
        trackEl.appendChild(fillEl);
      }

      const valEl = document.createElement('span');
      valEl.className = 'score-val';
      valEl.textContent = scores ? formatScore(val) : '-';

      rowEl.appendChild(labelEl);
      rowEl.appendChild(trackEl);
      rowEl.appendChild(valEl);
      els.colScoresList.appendChild(rowEl);
    }

    // Scoring Legend ala Figgle (Eval Function Breakdown)
    const info = AI_LIB.analyzeBoard(state.board, AI);
    if (els.legendTotalBadge) {
      els.legendTotalBadge.textContent = `Total: ${formatScore(info.totalScore)}`;
    }

    function renderMiniTiles(dots) {
      return (
        '<span class="mini-tiles">' +
        dots.map((d) => `<span class="mini-tile"><span class="mini-dot ${d}"></span></span>`).join('') +
        '</span>'
      );
    }

    const legendRows = [
      {
        dots: ['ai', 'ai', 'ai', 'ai'],
        label: '4-in-a-Row AI',
        count: state.winner === AI ? 'Menang' : '0x',
        pts: '+100000',
      },
      {
        dots: ['ai', 'ai', 'ai', 'empty'],
        label: '3 AI + 1 Kosong',
        count: `${info.aiThree}x`,
        pts: '+12',
      },
      {
        dots: ['ai', 'ai', 'empty', 'empty'],
        label: '2 AI + 2 Kosong',
        count: `${info.aiTwo}x`,
        pts: '+3',
      },
      {
        dots: ['opp', 'opp', 'opp', 'empty'],
        label: 'Ancaman 3 Lawan',
        count: `${info.oppThree}x`,
        pts: '-80',
      },
      {
        dots: ['opp', 'opp', 'empty', 'empty'],
        label: '2 Lawan + 2 Kosong',
        count: `${info.oppTwo}x`,
        pts: '-2',
      },
      {
        dots: ['center'],
        label: 'Kontrol Kolom Tengah',
        count: `AI ${info.centerAi}:${info.centerOpp}`,
        pts: `${info.centerScore >= 0 ? '+' : ''}${info.centerScore}`,
      },
    ];

    els.heuristicGrid.innerHTML = '';
    legendRows.forEach((row) => {
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
      els.heuristicGrid.appendChild(el);
    });
  }

  function renderMoveLog() {
    if (state.moveLog.length === 0) {
      els.moveLog.innerHTML = '<div class="move-log-empty">Belum ada langkah dimainkan.</div>';
      return;
    }
    els.moveLog.innerHTML = '';
    for (let i = state.moveLog.length - 1; i >= 0; i--) {
      const entry = state.moveLog[i];
      const div = document.createElement('div');
      div.className = 'move-log-item';
      div.innerHTML = `<span>#${entry.step} • ${entry.actor} → Kol ${entry.col} (Baris ${entry.row})</span><span>${entry.detail}</span>`;
      els.moveLog.appendChild(div);
    }
  }

  function renderAll() {
    updateLegendAndModeButtons();
    renderBoard();
    renderStatus();
    renderInspector();
    renderMoveLog();
    els.undoBtn.disabled = state.history.length === 0 || state.isThinking;
  }

  function executeDrop(col, player, aiResult) {
    const row = AI_LIB.getNextOpenRow(state.board, col);
    if (row === -1) return false;

    saveSnapshot();
    AI_LIB.dropPiece(state.board, row, col, player);
    state.moveCount += 1;
    state.lastMove = { row, col, animate: true };
    if (aiResult) {
      state.lastAiResult = aiResult;
    }

    const isBvb = els.gameModeSelect.value === 'bvb';
    const actor =
      player === HUMAN ? (isBvb ? 'Bot Coral' : 'Manusia') : isBvb ? 'Bot Kuning' : 'Bot AI';
    const detail = aiResult
      ? `eval ${formatScore(aiResult.bestScore)} | ${aiResult.nodes} node`
      : `eval papan ${formatScore(AI_LIB.evaluateBoard(state.board, AI))}`;

    state.moveLog.push({ step: state.moveCount, actor, col, row, detail });

    const winInfo = AI_LIB.getWinnerInfo(state.board);
    if (winInfo.winner !== null) {
      state.gameOver = true;
      state.winner = winInfo.winner;
      state.winCells = winInfo.cells;
      clearTimers();
    } else {
      state.currentPlayer = player === HUMAN ? AI : HUMAN;
    }

    renderAll();
    return true;
  }

  function handleHumanMove(col) {
    if (state.gameOver || state.isThinking) return;
    if (els.gameModeSelect.value !== 'hvb' || state.currentPlayer !== HUMAN) return;
    if (!AI_LIB.isValidLocation(state.board, col)) return;

    const moved = executeDrop(col, HUMAN, null);
    if (moved && !state.gameOver) {
      scheduleBotTurn();
    }
  }

  function scheduleBotTurn() {
    state.isThinking = true;
    renderAll();

    state.pendingBotTimer = setTimeout(() => {
      state.pendingBotTimer = null;
      if (state.gameOver) {
        state.isThinking = false;
        renderAll();
        return;
      }
      runSingleBotStep();
      state.isThinking = false;
      renderAll();
    }, 45);
  }

  function runSingleBotStep() {
    if (state.gameOver) return;
    const isBvb = els.gameModeSelect.value === 'bvb';
    const piece = state.currentPlayer;

    let res;
    if (isBvb && piece === HUMAN) {
      // Bot Merah di mode Bot vs Bot pakai Depth-Limited Minimax depth 3
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

  function resetGame() {
    clearTimers();
    state.board = AI_LIB.createBoard();
    state.currentPlayer = Number(els.firstPlayerSelect.value);
    state.gameOver = false;
    state.winner = null;
    state.winCells = [];
    state.lastMove = null;
    state.lastAiResult = null;
    state.moveCount = 0;
    state.moveLog = [];
    state.history = [];
    state.hoverCol = -1;

    els.compareResult.innerHTML =
      'Klik <strong>Bandingkan Node Sekarang</strong> kapan saja selama permainan untuk melihat hasil eksperimen langsung.';

    renderAll();

    if (els.gameModeSelect.value === 'hvb' && state.currentPlayer === AI) {
      scheduleBotTurn();
    }
  }

  function undoMove() {
    if (state.history.length === 0 || state.isThinking) return;
    clearTimers();

    if (els.gameModeSelect.value === 'hvb') {
      // Mundur ke giliran Manusia sebelumnya
      let targetIdx = state.history.length - 1;
      while (targetIdx > 0 && state.history[targetIdx].currentPlayer !== HUMAN) {
        targetIdx--;
      }
      const snap = state.history[targetIdx];
      state.history = state.history.slice(0, targetIdx);
      restoreSnapshot(snap);
      if (state.currentPlayer === AI && !state.gameOver) {
        renderAll();
        scheduleBotTurn();
        return;
      }
    } else {
      const snap = state.history.pop();
      restoreSnapshot(snap);
    }

    renderAll();
  }

  function toggleAutoPlay() {
    if (els.gameModeSelect.value !== 'bvb') return;
    if (state.autoPlayTimer) {
      clearInterval(state.autoPlayTimer);
      state.autoPlayTimer = null;
      els.autoPlayBtn.textContent = 'Auto-Play Bot vs Bot';
      return;
    }
    if (state.gameOver) {
      resetGame();
    }
    els.autoPlayBtn.textContent = 'Jeda Auto-Play';
    state.autoPlayTimer = setInterval(() => {
      if (state.gameOver) {
        clearTimers();
        renderAll();
        return;
      }
      runSingleBotStep();
    }, 380);
  }

  function runComparison() {
    if (state.gameOver) {
      els.compareResult.innerHTML = 'Permainan sudah selesai. Tekan <strong>Reset Permainan</strong> untuk membandingkan pada posisi papan aktif.';
      return;
    }

    const depth = Number(els.compareDepthSelect.value);
    const activePiece = els.gameModeSelect.value === 'bvb' ? state.currentPlayer : AI;
    const comp = AI_LIB.compareAlgorithms(state.board, depth, activePiece);

    els.compareResult.innerHTML = `
      <table class="compare-table">
        <thead>
          <tr>
            <th>Algoritma (Depth ${comp.maxDepth})</th>
            <th>Kolom</th>
            <th>Skor Eval</th>
            <th>Jumlah Node</th>
            <th>Waktu</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Depth-Limited Minimax Murni</td>
            <td>Kol ${comp.pureMinimax.bestCol}</td>
            <td>${formatScore(comp.pureMinimax.bestScore)}</td>
            <td>${comp.pureMinimax.nodes.toLocaleString('id-ID')}</td>
            <td>${comp.pureMinimax.elapsedMs} ms</td>
          </tr>
          <tr>
            <td>Depth-Limited + Alpha-Beta</td>
            <td>Kol ${comp.alphaBeta.bestCol}</td>
            <td>${formatScore(comp.alphaBeta.bestScore)}</td>
            <td>${comp.alphaBeta.nodes.toLocaleString('id-ID')}</td>
            <td>${comp.alphaBeta.elapsedMs} ms</td>
          </tr>
        </tbody>
      </table>
      <div class="compare-summary">
        Alpha-Beta Pruning memangkas <strong>${comp.reductionPct}%</strong> node pencarian (${(comp.pureMinimax.nodes - comp.alphaBeta.nodes).toLocaleString('id-ID')} node dihemat) dengan keputusan ${comp.sameDecision ? '100% IDENTIK' : 'berbeda'}.
      </div>
    `;
  }

  function bindEvents() {
    els.difficultySelect.addEventListener('change', () => {
      syncControlsWithDifficulty();
    });

    els.algorithmSelect.addEventListener('change', () => {
      els.difficultySelect.value = 'Custom';
      syncControlsWithDifficulty();
    });

    els.depthSelect.addEventListener('change', () => {
      els.difficultySelect.value = 'Custom';
      syncControlsWithDifficulty();
    });

    els.gameModeSelect.addEventListener('change', resetGame);
    els.firstPlayerSelect.addEventListener('change', resetGame);
    els.resetBtn.addEventListener('click', resetGame);
    els.undoBtn.addEventListener('click', undoMove);
    els.botStepBtn.addEventListener('click', () => {
      if (els.gameModeSelect.value === 'bvb' && !state.gameOver) {
        runSingleBotStep();
      }
    });
    els.autoPlayBtn.addEventListener('click', toggleAutoPlay);
    els.compareBtn.addEventListener('click', runComparison);

    els.tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        els.tabBtns.forEach((b) => b.classList.remove('active'));
        els.tabPanels.forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
      if (e.key >= '0' && e.key <= '6') {
        handleHumanMove(Number(e.key));
      }
    });
  }

  syncControlsWithDifficulty();
  bindEvents();
  resetGame();
})();
