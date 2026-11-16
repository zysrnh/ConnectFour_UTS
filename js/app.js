(function () {
  'use strict';

  const AI_LIB = window.ConnectFourAI;
  const { ROWS, COLS, BLOCKED, EMPTY, HUMAN, AI, WIN_SCORE } = AI_LIB;

  const state = {
    view: 'home', // 'home' | 'setup' | 'game'
    gameMode: 'hvb', // 'hvb' | 'bvb'
    boardMode: 'classic', // 'classic' | 'obstacle' | 'star'
    tileShape: 'circle', // 'circle' | 'square'
    difficulty: 'Hard', // 'Easy' | 'Medium' | 'Hard' | 'Custom'
    firstChoice: '1', // '1' | '2' | 'random'
    resolvedFirstPlayer: HUMAN,
    randomStartNote: '',
    board: AI_LIB.createBoard(),
    starCells: [],
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
    matchGeneration: 0,
    autoPlayTimer: null,
    pendingBotTimer: null,
    postGameTimer: null,
    hoverCol: -1,
  };

  const modalCloseTimers = new WeakMap();

  async function requestBotMove(board, options) {
    const bridge = window.ConnectFourBridge;
    if (bridge && typeof bridge.chooseMove === 'function') {
      return await bridge.chooseMove(board, options);
    }
    return AI_LIB.chooseMove(board, options);
  }

  async function requestCompare(board, depth, aiPiece, starCells) {
    const bridge = window.ConnectFourBridge;
    if (bridge && typeof bridge.compareAlgorithms === 'function') {
      return await bridge.compareAlgorithms(board, depth, aiPiece, starCells);
    }
    return AI_LIB.compareAlgorithms(board, depth, aiPiece, starCells);
  }

  const els = {
    // Views
    homeView: document.getElementById('homeView'),
    setupView: document.getElementById('setupView'),
    gameView: document.getElementById('gameView'),
    arenaShell: document.getElementById('arenaShell'),

    // Home Menu
    goSetupBtn: document.getElementById('goSetupBtn'),
    openRulesBtn: document.getElementById('openRulesBtn'),
    openInfoBtn: document.getElementById('openInfoBtn'),

    // Setup Menu
    backHomeBtn: document.getElementById('backHomeBtn'),
    setupPreviewBadge: document.getElementById('setupPreviewBadge'),
    modeChoiceGrid: document.getElementById('modeChoiceGrid'),
    boardModeGrid: document.getElementById('boardModeGrid'),
    tileShapeGrid: document.getElementById('tileShapeGrid'),
    diffChoiceGrid: document.getElementById('diffChoiceGrid'),
    firstChoiceGrid: document.getElementById('firstChoiceGrid'),
    firstP1Title: document.getElementById('firstP1Title'),
    customConfigBox: document.getElementById('customConfigBox'),
    algorithmSelect: document.getElementById('algorithmSelect'),
    depthSelect: document.getElementById('depthSelect'),
    startGameBtn: document.getElementById('startGameBtn'),

    // Modals
    rulesModal: document.getElementById('rulesModal'),
    closeRulesBtn: document.getElementById('closeRulesBtn'),
    infoModal: document.getElementById('infoModal'),
    closeInfoBtn: document.getElementById('closeInfoBtn'),
    modalLegendList: document.getElementById('modalLegendList'),

    // Arena
    arenaPill: document.getElementById('arenaPill'),
    backMenuBtn: document.getElementById('backMenuBtn'),
    backSetupBtn: document.getElementById('backSetupBtn'),
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
    p1Swatch: document.getElementById('p1Swatch'),
    p2Swatch: document.getElementById('p2Swatch'),
    p1LegendLabel: document.getElementById('p1LegendLabel'),
    p2LegendLabel: document.getElementById('p2LegendLabel'),
    specialTileLegend: document.getElementById('specialTileLegend'),

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
      return { difficulty: 'Hard', usePruning: true, maxDepth: 5, label: 'Hard • α-β d=5' };
    }
    const usePruning = els.algorithmSelect.value === 'alphabeta';
    const maxDepth = Number(els.depthSelect.value);
    const algoTxt = usePruning ? 'α-β' : 'Minimax';
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

  function pulsePickedCard(cardEl) {
    if (!cardEl) return;
    cardEl.classList.remove('just-picked');
    if (typeof cardEl.offsetWidth === 'number') {
      void cardEl.offsetWidth;
    }
    cardEl.classList.add('just-picked');
  }

  function openModal(modalEl) {
    if (!modalEl) return;
    const pending = modalCloseTimers.get(modalEl);
    if (pending) {
      clearTimeout(pending);
      modalCloseTimers.delete(modalEl);
    }
    modalEl.classList.remove('is-closing');
    modalEl.style.display = 'flex';
  }

  function closeModal(modalEl) {
    if (!modalEl || modalEl.style.display === 'none' || modalEl.classList.contains('is-closing')) {
      return;
    }
    modalEl.classList.add('is-closing');
    const timer = setTimeout(() => {
      modalCloseTimers.delete(modalEl);
      modalEl.style.display = 'none';
      modalEl.classList.remove('is-closing');
    }, 180);
    modalCloseTimers.set(modalEl, timer);
  }

  function syncMenuUI() {
    els.modeChoiceGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === state.gameMode);
    });
    els.boardModeGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.bmode === state.boardMode);
    });
    els.tileShapeGrid.querySelectorAll('.shape-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.shape === state.tileShape);
    });
    els.diffChoiceGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.diff === state.difficulty);
    });
    els.firstChoiceGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.first === state.firstChoice);
    });

    els.firstP1Title.textContent = state.gameMode === 'bvb' ? 'Bot Coral' : 'Manusia';
    els.customConfigBox.style.display = state.difficulty === 'Custom' ? 'block' : 'none';

    const cfg = getAiConfig();
    const modeTag = state.boardMode === 'classic' ? '' : state.boardMode === 'obstacle' ? ' • Batu' : ' • Star';
    els.setupPreviewBadge.textContent = `${cfg.label}${modeTag}`;
    els.activeConfigBadge.textContent = `${cfg.label}${modeTag}`;
  }

  function clearTimers() {
    if (state.pendingBotTimer) {
      clearTimeout(state.pendingBotTimer);
      state.pendingBotTimer = null;
    }
    if (state.autoPlayTimer) {
      clearTimeout(state.autoPlayTimer);
      state.autoPlayTimer = null;
    }
    if (state.postGameTimer) {
      clearTimeout(state.postGameTimer);
      state.postGameTimer = null;
    }
    state.isThinking = false;
  }

  function retriggerStagePop(viewEl) {
    const stage = viewEl && viewEl.querySelector ? viewEl.querySelector('.animate-pop-in') : null;
    if (!stage) return;
    stage.classList.remove('animate-pop-in');
    if (typeof stage.offsetWidth === 'number') {
      void stage.offsetWidth;
    }
    stage.classList.add('animate-pop-in');
  }

  function switchView(viewName) {
    state.view = viewName;
    els.homeView.style.display = viewName === 'home' ? 'flex' : 'none';
    els.setupView.style.display = viewName === 'setup' ? 'flex' : 'none';
    els.gameView.style.display = viewName === 'game' ? 'block' : 'none';

    if (viewName === 'home') retriggerStagePop(els.homeView);
    else if (viewName === 'setup') retriggerStagePop(els.setupView);
  }

  function renderScoringLegend(targetEl, info, winner, includeStarRow = false) {
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

    if (includeStarRow) {
      rows.push({
        dots: ['star'],
        label: 'Bonus Petak Star (★)',
        count: info ? `AI ${info.starAi}:${info.starOpp}` : 'mode Star',
        pts: info ? `${info.starScore >= 0 ? '+' : ''}${info.starScore}` : '+6',
      });
    }

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

  function isStarCell(r, c) {
    for (let i = 0; i < state.starCells.length; i++) {
      if (state.starCells[i][0] === r && state.starCells[i][1] === c) return true;
    }
    return false;
  }

  function saveSnapshot() {
    state.history.push({
      board: AI_LIB.cloneBoard(state.board),
      starCells: state.starCells.map((p) => p.slice()),
      currentPlayer: state.currentPlayer,
      gameOver: state.gameOver,
      winner: state.winner,
      winCells: state.winCells.slice(),
      lastMove: state.lastMove ? { ...state.lastMove } : null,
      lastAiResult: state.lastAiResult ? { ...state.lastAiResult, columnScores: { ...state.lastAiResult.columnScores } } : null,
      moveCount: state.moveCount,
      moveLog: state.moveLog.slice(),
      compareTarget: state.compareTarget
        ? {
            board: AI_LIB.cloneBoard(state.compareTarget.board),
            aiPiece: state.compareTarget.aiPiece,
            step: state.compareTarget.step,
            starCells: state.compareTarget.starCells.map((p) => p.slice()),
          }
        : null,
    });
  }

  function restoreSnapshot(snap) {
    state.board = AI_LIB.cloneBoard(snap.board);
    state.starCells = snap.starCells.map((p) => p.slice());
    state.currentPlayer = snap.currentPlayer;
    state.gameOver = snap.gameOver;
    state.winner = snap.winner;
    state.winCells = snap.winCells.slice();
    state.lastMove = snap.lastMove ? { ...snap.lastMove } : null;
    state.lastAiResult = snap.lastAiResult;
    state.moveCount = snap.moveCount;
    state.moveLog = snap.moveLog.slice();
    state.compareTarget = snap.compareTarget
      ? {
          board: AI_LIB.cloneBoard(snap.compareTarget.board),
          aiPiece: snap.compareTarget.aiPiece,
          step: snap.compareTarget.step,
          starCells: snap.compareTarget.starCells.map((p) => p.slice()),
        }
      : null;
  }

  function renderBoard() {
    const isBvb = state.gameMode === 'bvb';
    const humanCanClick = !state.gameOver && !state.isThinking && !isBvb && state.currentPlayer === HUMAN;
    const isSquare = state.tileShape === 'square';

    els.boardGrid.classList.toggle('shape-square', isSquare);
    els.p1Swatch.classList.toggle('shape-square', isSquare);
    els.p2Swatch.classList.toggle('shape-square', isSquare);
    els.statusDot.classList.toggle('shape-square', isSquare);

    // Ghost Hover Preview Row
    els.hoverPreviewRow.innerHTML = '';
    for (let c = 0; c < COLS; c++) {
      const slot = document.createElement('div');
      slot.className = 'ghost-slot';
      const ghost = document.createElement('div');
      ghost.className = `ghost-disc${isSquare ? ' shape-square' : ''}`;
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
      btn.title = `Jatuhkan ke Kolom ${c}`;
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

        const val = state.board[r][c];
        const blocked = val === BLOCKED;
        const star = isStarCell(r, c);

        if (blocked) {
          cell.classList.add('is-blocked', 'disabled');
        } else if (!humanCanClick || !AI_LIB.isValidLocation(state.board, c)) {
          cell.classList.add('disabled');
        }

        if (star) {
          cell.classList.add('is-star');
          if (val === HUMAN || val === AI) cell.classList.add('has-disc');
        }

        if (state.lastMove && state.lastMove.row === r && state.lastMove.col === c) {
          cell.classList.add('last-move');
        }
        const winIdx = getWinningIndex(r, c);
        if (winIdx !== -1) {
          cell.classList.add('win-cell');
          cell.style.setProperty('--win-idx', String(winIdx));
        }

        if (val === HUMAN || val === AI) {
          const disc = document.createElement('div');
          disc.className = `disc ${val === HUMAN ? 'p1' : 'p2'}`;
          if (state.lastMove && state.lastMove.row === r && state.lastMove.col === c && state.lastMove.animate) {
            disc.classList.add('drop-anim');
            disc.style.setProperty('--drop-rows', String(r + 1));
          }
          cell.appendChild(disc);
        }

        if (!blocked) {
          cell.addEventListener('mouseenter', () => setHoverCol(c));
          cell.addEventListener('mouseleave', () => setHoverCol(-1));
          cell.addEventListener('click', () => {
            if (humanCanClick) handleHumanMove(c);
          });
        }
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
    const modeLabel = state.boardMode === 'obstacle' ? 'OBSTACLE' : state.boardMode === 'star' ? 'STAR +6' : 'ARENA';
    els.arenaPill.textContent = isBvb ? `BOT VS BOT • ${modeLabel}` : `${modeLabel} MAIN`;

    els.p1LegendLabel.textContent = isBvb ? 'Bot Coral (d=3)' : 'Manusia';
    els.p2LegendLabel.textContent = isBvb ? 'Bot Kuning' : 'Bot AI';

    if (state.boardMode === 'obstacle') {
      els.specialTileLegend.style.display = 'inline-flex';
      els.specialTileLegend.textContent = '✕ Batu Rintangan';
    } else if (state.boardMode === 'star') {
      els.specialTileLegend.style.display = 'inline-flex';
      els.specialTileLegend.textContent = '★ Bonus +6';
    } else {
      els.specialTileLegend.style.display = 'none';
    }

    els.bvbBar.style.display = isBvb && !state.gameOver ? 'flex' : 'none';
    els.autoPlayBtn.textContent = state.autoPlayPaused ? 'Lanjut Auto-Play' : 'Jeda Auto-Play';

    els.turnCounterBadge.textContent = `#${state.moveCount}`;
    els.undoBtn.disabled = state.history.length === 0 || state.isThinking;

    if (state.lastAiResult) {
      els.lastMovePill.style.display = 'inline-block';
      els.lastMovePill.textContent = `Kol ${state.lastAiResult.bestCol} (${formatScore(state.lastAiResult.bestScore)})`;
    } else {
      els.lastMovePill.style.display = 'none';
    }

    els.statusBanner.className = 'status-banner';
    els.statusDot.className = `status-dot${state.tileShape === 'square' ? ' shape-square' : ''}`;
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
            state.winner === HUMAN ? 'Selamat! Anda MENANG!' : 'Bot AI MENANG!';
        }
      }
      return;
    }

    if (state.isThinking) {
      els.statusBanner.classList.add(state.currentPlayer === HUMAN ? 'turn-p1' : 'turn-p2');
      els.statusDot.classList.add(state.currentPlayer === HUMAN ? 'p1' : 'p2');
      els.statusText.textContent = 'Bot AI sedang berpikir';
      els.thinkingDots.classList.add('active');
      return;
    }

    const prefix = state.moveCount === 0 && state.randomStartNote ? `${state.randomStartNote} ` : '';
    if (state.currentPlayer === HUMAN) {
      els.statusBanner.classList.add('turn-p1');
      els.statusDot.classList.add('p1');
      els.statusText.textContent = isBvb
        ? `${prefix}Giliran Bot Coral...`
        : `${prefix}Giliran Anda — Pilih Kolom 0–6`;
    } else {
      els.statusBanner.classList.add('turn-p2');
      els.statusDot.classList.add('p2');
      els.statusText.textContent = isBvb
        ? `${prefix}Giliran Bot Kuning...`
        : `${prefix}Giliran Bot AI...`;
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

    els.postGameTableBody.innerHTML = '';
    state.moveLog.forEach((entry, idx) => {
      const tr = document.createElement('tr');
      tr.style.setProperty('--row-idx', String(idx));
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

    const finalInfo = AI_LIB.analyzeBoard(state.board, AI, state.starCells);
    els.legendTotalBadge.textContent = `Total: ${formatScore(finalInfo.totalScore)}`;
    renderScoringLegend(els.heuristicGrid, finalInfo, state.winner, state.boardMode === 'star');

    if (state.compareTarget) {
      els.compareContextText.textContent =
        `Bandingkan jumlah node pada langkah #${state.compareTarget.step} (sebelum langkah penutup).`;
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

    state.compareTarget = {
      board: preMoveBoard,
      aiPiece: player === HUMAN && state.gameMode === 'hvb' ? AI : player,
      step: state.moveCount,
      starCells: state.starCells.map((p) => p.slice()),
    };

    const isBvb = state.gameMode === 'bvb';
    const isBot = isBvb || player === AI;
    const actor =
      player === HUMAN ? (isBvb ? 'Bot Coral' : 'Manusia') : isBvb ? 'Bot Kuning' : 'Bot AI';

    const scoreText = aiResult
      ? formatScore(aiResult.bestScore)
      : formatScore(AI_LIB.evaluateBoard(state.board, AI, state.starCells));

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
    const gen = state.matchGeneration;
    state.isThinking = true;
    renderArenaHeaderAndStatus();
    applyHoverVisuals();

    state.pendingBotTimer = setTimeout(async () => {
      state.pendingBotTimer = null;
      if (state.gameOver || gen !== state.matchGeneration) {
        state.isThinking = false;
        renderArenaHeaderAndStatus();
        return;
      }
      await runSingleBotStep(gen);
    }, 60);
  }

  async function runSingleBotStep(expectedGen = state.matchGeneration) {
    if (state.gameOver || expectedGen !== state.matchGeneration) return;
    const isBvb = state.gameMode === 'bvb';
    const piece = state.currentPlayer;

    state.isThinking = true;
    renderArenaHeaderAndStatus();

    const boardCopy = AI_LIB.cloneBoard(state.board);
    const starCopy = state.starCells.map((p) => p.slice());
    let res;
    if (isBvb && piece === HUMAN) {
      res = await requestBotMove(boardCopy, {
        difficulty: 'Medium',
        aiPiece: HUMAN,
        usePruning: false,
        customDepth: 3,
        starCells: starCopy,
      });
    } else {
      const cfg = getAiConfig();
      res = await requestBotMove(boardCopy, {
        difficulty: cfg.difficulty,
        aiPiece: piece,
        usePruning: cfg.usePruning,
        customDepth: cfg.difficulty === 'Custom' ? cfg.maxDepth : undefined,
        starCells: starCopy,
      });
    }

    if (expectedGen !== state.matchGeneration || state.gameOver) {
      state.isThinking = false;
      return;
    }

    state.isThinking = false;
    if (res && res.bestCol !== -1) {
      executeDrop(res.bestCol, piece, res);
    } else {
      renderArenaHeaderAndStatus();
    }
  }

  async function startAutoPlayLoop() {
    if (state.gameMode !== 'bvb' || state.gameOver) return;
    if (state.autoPlayTimer) {
      clearTimeout(state.autoPlayTimer);
      state.autoPlayTimer = null;
    }
    const gen = state.matchGeneration;
    state.autoPlayPaused = false;
    renderArenaHeaderAndStatus();

    while (!state.gameOver && !state.autoPlayPaused && gen === state.matchGeneration && state.view === 'game') {
      await runSingleBotStep(gen);
      if (state.gameOver || state.autoPlayPaused || gen !== state.matchGeneration || state.view !== 'game') {
        break;
      }
      await new Promise((resolve) => {
        state.autoPlayTimer = setTimeout(() => {
          state.autoPlayTimer = null;
          resolve();
        }, 420);
      });
    }
  }

  function resetGame() {
    state.matchGeneration += 1;
    clearTimers();

    const setup = AI_LIB.createSpecialSetup(state.boardMode);
    state.board = setup.board;
    state.starCells = setup.starCells;

    if (state.firstChoice === 'random') {
      state.resolvedFirstPlayer = Math.random() < 0.5 ? HUMAN : AI;
      state.randomStartNote =
        state.resolvedFirstPlayer === HUMAN
          ? state.gameMode === 'bvb' ? '[Acak: Coral duluan]' : '[Acak: Anda duluan]'
          : state.gameMode === 'bvb' ? '[Acak: Kuning duluan]' : '[Acak: Bot duluan]';
    } else {
      state.resolvedFirstPlayer = Number(state.firstChoice);
      state.randomStartNote = '';
    }

    state.currentPlayer = state.resolvedFirstPlayer;
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
      'Klik <strong>Bandingkan Node</strong> untuk melihat selisih efisiensi Minimax vs Alpha-Beta.';

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

  function goToHome() {
    state.matchGeneration += 1;
    clearTimers();
    switchView('home');
  }

  function goToSetup() {
    state.matchGeneration += 1;
    clearTimers();
    syncMenuUI();
    switchView('setup');
  }

  function undoMove() {
    if (state.history.length === 0 || state.isThinking) return;
    state.matchGeneration += 1;
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
        clearTimeout(state.autoPlayTimer);
        state.autoPlayTimer = null;
      }
      renderArenaHeaderAndStatus();
    }
  }

  async function runPostGameComparison() {
    const target = state.compareTarget;
    if (!target) return;
    const depth = Number(els.compareDepthSelect.value);
    els.compareBtn.disabled = true;
    els.compareResult.innerHTML = 'Menghitung perbandingan Minimax vs Alpha-Beta...';
    const comp = await requestCompare(target.board, depth, target.aiPiece, target.starCells || []);
    els.compareBtn.disabled = false;

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
      pulsePickedCard(btn);
    });

    els.boardModeGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      state.boardMode = btn.dataset.bmode;
      syncMenuUI();
      pulsePickedCard(btn);
    });

    els.tileShapeGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.shape-btn');
      if (!btn) return;
      state.tileShape = btn.dataset.shape;
      syncMenuUI();
    });

    els.diffChoiceGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      state.difficulty = btn.dataset.diff;
      syncMenuUI();
      pulsePickedCard(btn);
    });

    els.firstChoiceGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      state.firstChoice = btn.dataset.first;
      syncMenuUI();
      pulsePickedCard(btn);
    });

    els.algorithmSelect.addEventListener('change', syncMenuUI);
    els.depthSelect.addEventListener('change', syncMenuUI);

    els.goSetupBtn.addEventListener('click', goToSetup);
    els.backHomeBtn.addEventListener('click', goToHome);
    els.startGameBtn.addEventListener('click', startNewMatchFromMenu);
    els.backMenuBtn.addEventListener('click', goToHome);
    els.backSetupBtn.addEventListener('click', goToSetup);
    els.postMenuBtn.addEventListener('click', goToHome);
    els.playAgainBtn.addEventListener('click', resetGame);
    els.resetBtn.addEventListener('click', resetGame);
    els.undoBtn.addEventListener('click', undoMove);

    els.botStepBtn.addEventListener('click', () => {
      if (state.gameMode === 'bvb' && !state.gameOver && !state.isThinking) {
        state.autoPlayPaused = true;
        if (state.autoPlayTimer) {
          clearTimeout(state.autoPlayTimer);
          state.autoPlayTimer = null;
        }
        runSingleBotStep(state.matchGeneration);
      }
    });
    els.autoPlayBtn.addEventListener('click', toggleAutoPlay);
    els.compareBtn.addEventListener('click', runPostGameComparison);

    els.openRulesBtn.addEventListener('click', () => openModal(els.rulesModal));
    els.closeRulesBtn.addEventListener('click', () => closeModal(els.rulesModal));
    els.rulesModal.addEventListener('click', (e) => {
      if (e.target === els.rulesModal) closeModal(els.rulesModal);
    });

    els.openInfoBtn.addEventListener('click', () => {
      renderScoringLegend(els.modalLegendList, null, null, true);
      openModal(els.infoModal);
    });
    els.closeInfoBtn.addEventListener('click', () => closeModal(els.infoModal));
    els.infoModal.addEventListener('click', (e) => {
      if (e.target === els.infoModal) closeModal(els.infoModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (els.rulesModal.style.display === 'flex') {
          closeModal(els.rulesModal);
          return;
        }
        if (els.infoModal.style.display === 'flex') {
          closeModal(els.infoModal);
          return;
        }
      }
      if (state.view !== 'game' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
      if (e.key >= '0' && e.key <= '6') {
        handleHumanMove(Number(e.key));
      }
    });
  }

  syncMenuUI();
  bindEvents();
  switchView('home');
})();
