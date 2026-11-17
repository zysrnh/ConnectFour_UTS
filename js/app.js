(function () {
  'use strict';

  const AI_LIB = window.ConnectFourAI;
  const { ROWS, COLS, BLOCKED, EMPTY, HUMAN, AI, WIN_SCORE } = AI_LIB;

  const PLAYER_META = {
    1: { num: 1, color: 'Coral', css: 'p1' },
    2: { num: 2, color: 'Kuning', css: 'p2' },
    3: { num: 3, color: 'Hijau', css: 'p3' },
    4: { num: 4, color: 'Ungu', css: 'p4' },
  };

  const FOUR_PRESETS = {
    '4human': { 1: 'human', 2: 'human', 3: 'human', 4: 'human' },
    '1h3b': { 1: 'human', 2: 'bot', 3: 'bot', 4: 'bot' },
    '2h2b': { 1: 'human', 2: 'human', 3: 'bot', 4: 'bot' },
    '4bot': { 1: 'bot', 2: 'bot', 3: 'bot', 4: 'bot' },
  };

  const state = {
    view: 'home', // 'home' | 'setup' | 'game'
    gameMode: 'hvb', // 'hvb' | 'pvp' | '4p' | 'bvb'
    fourSeats: { 1: 'human', 2: 'bot', 3: 'bot', 4: 'bot' },
    boardMode: 'classic', // 'classic' | 'obstacle'
    boardSize: '6x7', // '6x7' | '7x8' | '7x9'
    userPickedSize: false,
    difficulty: 'Hard', // 'Easy' | 'Medium' | 'Hard' | 'Custom'
    firstChoice: '1', // '1' | '2' | '3' | '4' | 'random'
    resolvedFirstPlayer: HUMAN,
    randomStartNote: '',
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
    matchGeneration: 0,
    autoPlayTimer: null,
    pendingBotTimer: null,
    postGameTimer: null,
    hoverCol: -1,
  };

  const modalCloseTimers = new WeakMap();

  function getPlayerCount() {
    return state.gameMode === '4p' ? 4 : 2;
  }

  function getSeatRoles() {
    if (state.gameMode === 'hvb') return { 1: 'human', 2: 'bot' };
    if (state.gameMode === 'pvp') return { 1: 'human', 2: 'human' };
    if (state.gameMode === 'bvb') return { 1: 'bot', 2: 'bot' };
    return { ...state.fourSeats };
  }

  function isBotPlayer(piece) {
    return getSeatRoles()[piece] === 'bot';
  }

  function hasAnyBot() {
    return Object.values(getSeatRoles()).includes('bot');
  }

  function isAllBots() {
    return Object.values(getSeatRoles()).every((role) => role === 'bot');
  }

  function getPlayerLabel(piece, short = false) {
    const meta = PLAYER_META[piece] || PLAYER_META[1];
    if (state.gameMode === 'hvb') {
      return piece === HUMAN ? (short ? 'Manusia' : 'Manusia (Coral)') : (short ? 'Bot AI' : 'Bot AI (Kuning)');
    }
    if (state.gameMode === 'pvp') {
      return short ? `Pemain ${piece}` : `Pemain ${piece} (${meta.color})`;
    }
    if (state.gameMode === 'bvb') {
      return short ? `Bot ${meta.color}` : `Bot ${piece} (${meta.color})`;
    }
    const roleTxt = isBotPlayer(piece) ? 'Bot' : 'P';
    return short ? `${roleTxt}${piece} (${meta.color})` : `${isBotPlayer(piece) ? 'Bot' : 'Pemain'} ${piece} (${meta.color})`;
  }

  async function requestBotMove(board, options) {
    const bridge = window.ConnectFourBridge;
    if (bridge && typeof bridge.chooseMove === 'function') {
      return await bridge.chooseMove(board, options);
    }
    return AI_LIB.chooseMove(board, options);
  }

  async function requestCompare(board, depth, aiPiece, playerCount) {
    const bridge = window.ConnectFourBridge;
    if (bridge && typeof bridge.compareAlgorithms === 'function') {
      return await bridge.compareAlgorithms(board, depth, aiPiece, playerCount);
    }
    return AI_LIB.compareAlgorithms(board, depth, aiPiece, playerCount);
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
    fourPlayerBox: document.getElementById('fourPlayerBox'),
    fourPresetGrid: document.getElementById('fourPresetGrid'),
    fourSeatsGrid: document.getElementById('fourSeatsGrid'),
    boardModeGrid: document.getElementById('boardModeGrid'),
    boardSizeGrid: document.getElementById('boardSizeGrid'),
    diffSection: document.getElementById('diffSection'),
    diffChoiceGrid: document.getElementById('diffChoiceGrid'),
    firstSectionLabel: document.getElementById('firstSectionLabel'),
    firstChoiceGrid: document.getElementById('firstChoiceGrid'),
    firstP1Title: document.getElementById('firstP1Title'),
    firstP1Sub: document.getElementById('firstP1Sub'),
    firstP2Title: document.getElementById('firstP2Title'),
    firstP2Sub: document.getElementById('firstP2Sub'),
    firstP3Title: document.getElementById('firstP3Title'),
    firstP4Title: document.getElementById('firstP4Title'),
    firstRandomSub: document.getElementById('firstRandomSub'),
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
    boardLegend: document.getElementById('boardLegend'),

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
    const is4P = getPlayerCount() === 4;
    if (state.difficulty === 'Easy') {
      return { difficulty: 'Easy', usePruning: false, maxDepth: 0, label: 'Easy • Random' };
    }
    if (state.difficulty === 'Medium') {
      return { difficulty: 'Medium', usePruning: false, maxDepth: 3, label: 'Medium • d=3' };
    }
    if (state.difficulty === 'Hard') {
      const hardDepth = is4P ? 4 : 5;
      return { difficulty: 'Hard', usePruning: true, maxDepth: hardDepth, label: `Hard • α-β d=${hardDepth}` };
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

  function syncFourPlayerSeatsUI() {
    if (!els.fourPlayerBox) return;
    const is4P = state.gameMode === '4p';
    els.fourPlayerBox.style.display = is4P ? 'block' : 'none';
    if (!is4P) return;

    for (let seat = 1; seat <= 4; seat++) {
      const tag = els.fourSeatsGrid.querySelector(`[data-role-for="${seat}"]`);
      if (!tag) continue;
      const isBot = state.fourSeats[seat] === 'bot';
      tag.textContent = isBot ? 'Bot' : 'Manusia';
      tag.classList.toggle('is-bot', isBot);
    }

    if (els.fourPresetGrid) {
      els.fourPresetGrid.querySelectorAll('.preset-chip').forEach((chip) => {
        const preset = FOUR_PRESETS[chip.dataset.preset];
        const match = preset && [1, 2, 3, 4].every((s) => preset[s] === state.fourSeats[s]);
        chip.classList.toggle('active', Boolean(match));
      });
    }
  }

  function syncMenuUI() {
    els.modeChoiceGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === state.gameMode);
    });
    els.boardModeGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.bmode === state.boardMode);
    });
    if (els.boardSizeGrid) {
      els.boardSizeGrid.querySelectorAll('.size-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.size === state.boardSize);
      });
    }

    syncFourPlayerSeatsUI();

    const botsPresent = hasAnyBot();
    if (els.diffSection) {
      els.diffSection.style.display = botsPresent ? 'block' : 'none';
    }
    els.diffChoiceGrid.querySelectorAll('.choice-card').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.diff === state.difficulty);
    });
    els.customConfigBox.style.display = botsPresent && state.difficulty === 'Custom' ? 'block' : 'none';

    const is4P = state.gameMode === '4p';
    if (!is4P && (state.firstChoice === '3' || state.firstChoice === '4')) {
      state.firstChoice = '1';
    }

    els.firstChoiceGrid.classList.toggle('cols-5-first', is4P);
    els.firstChoiceGrid.classList.toggle('cols-3-always', !is4P);
    els.firstChoiceGrid.querySelectorAll('.choice-card').forEach((btn) => {
      const f = btn.dataset.first;
      if (f === '3' || f === '4') {
        btn.style.display = is4P ? 'flex' : 'none';
      }
      btn.classList.toggle('active', f === state.firstChoice);
    });

    if (els.firstSectionLabel) {
      els.firstSectionLabel.textContent = botsPresent ? '4. Jalan Pertama' : '3. Jalan Pertama';
    }

    if (state.gameMode === 'hvb') {
      els.firstP1Title.textContent = 'Manusia';
      els.firstP2Title.textContent = 'Bot AI';
    } else if (state.gameMode === 'pvp') {
      els.firstP1Title.textContent = 'Pemain 1';
      els.firstP2Title.textContent = 'Pemain 2';
    } else if (state.gameMode === 'bvb') {
      els.firstP1Title.textContent = 'Bot Coral';
      els.firstP2Title.textContent = 'Bot Kuning';
    } else {
      els.firstP1Title.textContent = state.fourSeats[1] === 'bot' ? 'Bot 1' : 'Manusia 1';
      els.firstP2Title.textContent = state.fourSeats[2] === 'bot' ? 'Bot 2' : 'Manusia 2';
      if (els.firstP3Title) els.firstP3Title.textContent = state.fourSeats[3] === 'bot' ? 'Bot 3' : 'Manusia 3';
      if (els.firstP4Title) els.firstP4Title.textContent = state.fourSeats[4] === 'bot' ? 'Bot 4' : 'Manusia 4';
    }
    if (els.firstRandomSub) {
      els.firstRandomSub.textContent = is4P ? 'Undi 1–4' : 'Undi 50:50';
    }

    const modeTagMap = {
      hvb: '2P vs AI',
      pvp: 'PvP 2P',
      '4p': '4-Player',
      bvb: 'Bot Duel',
    };
    const obsTag = state.boardMode === 'obstacle' ? ' • Batu' : '';
    const cfg = getAiConfig();
    const diffTag = botsPresent ? ` • ${cfg.label}` : '';
    const badgeText = `${modeTagMap[state.gameMode]}${diffTag}${obsTag} • ${state.boardSize}`;
    els.setupPreviewBadge.textContent = badgeText;
    els.activeConfigBadge.textContent = badgeText;
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

  function renderScoringLegend(targetEl, info, winner, evalPiece = AI) {
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
        label: '4-in-a-Row Menang',
        count: winner && winner !== 'DRAW' ? (winner === evalPiece ? 'Menang' : 'Lawan') : info ? '0x' : 'Terminal',
        pts: '+100000',
      },
      {
        dots: ['ai', 'ai', 'ai', 'empty'],
        label: '3 Sewarna + 1 Kosong',
        count: info ? `${info.aiThree}x` : 'per pola',
        pts: '+12',
      },
      {
        dots: ['ai', 'ai', 'empty', 'empty'],
        label: '2 Sewarna + 2 Kosong',
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
        count: info ? `P${evalPiece} ${info.centerAi}:${info.centerOpp}` : 'per selisih',
        pts: info ? `${info.centerScore >= 0 ? '+' : ''}${info.centerScore}` : '+4 / +2',
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
        ? {
            board: AI_LIB.cloneBoard(state.compareTarget.board),
            aiPiece: state.compareTarget.aiPiece,
            playerCount: state.compareTarget.playerCount,
            step: state.compareTarget.step,
          }
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
      ? {
          board: AI_LIB.cloneBoard(snap.compareTarget.board),
          aiPiece: snap.compareTarget.aiPiece,
          playerCount: snap.compareTarget.playerCount,
          step: snap.compareTarget.step,
        }
      : null;
  }

  function renderBoard() {
    const humanCanClick = !state.gameOver && !state.isThinking && !isBotPlayer(state.currentPlayer);
    const rows = state.board.length;
    const cols = state.board[0].length;
    const activeCss = (PLAYER_META[state.currentPlayer] || PLAYER_META[1]).css;

    [els.hoverPreviewRow, els.colSelectors, els.boardGrid].forEach((el) => {
      if (!el || !el.style) return;
      el.style.setProperty('--board-cols', String(cols));
      el.style.setProperty('--board-rows', String(rows));
    });

    // Ghost Hover Preview Row (colored to match current player)
    els.hoverPreviewRow.innerHTML = '';
    for (let c = 0; c < cols; c++) {
      const slot = document.createElement('div');
      slot.className = 'ghost-slot';
      const ghost = document.createElement('div');
      ghost.className = `ghost-disc ${activeCss}`;
      ghost.dataset.col = String(c);
      slot.appendChild(ghost);
      els.hoverPreviewRow.appendChild(slot);
    }

    // Column selector buttons
    els.colSelectors.innerHTML = '';
    for (let c = 0; c < cols; c++) {
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

    // Dynamic Grid (6x7 / 7x8 / 7x9)
    els.boardGrid.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);

        const val = state.board[r][c];
        const blocked = val === BLOCKED;
        const isPiece = val >= 1 && val <= 4;

        if (blocked) {
          cell.classList.add('is-blocked', 'disabled');
        } else if (!humanCanClick || !AI_LIB.isValidLocation(state.board, c)) {
          cell.classList.add('disabled');
        }

        const winIdx = getWinningIndex(r, c);
        if (winIdx !== -1) {
          cell.classList.add('win-cell');
          cell.style.setProperty('--win-idx', String(winIdx));
        }

        if (isPiece) {
          const meta = PLAYER_META[val] || PLAYER_META[1];
          const disc = document.createElement('div');
          disc.className = `disc ${meta.css}`;
          if (state.lastMove && state.lastMove.row === r && state.lastMove.col === c) {
            disc.classList.add('is-last-disc');
            if (state.lastMove.animate) {
              disc.classList.add('drop-anim');
              disc.style.setProperty('--drop-rows', String(r + 1));
            }
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
    const humanCanClick = !state.gameOver && !state.isThinking && !isBotPlayer(state.currentPlayer);
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

  function renderBoardLegend() {
    if (!els.boardLegend) return;
    const count = getPlayerCount();
    els.boardLegend.innerHTML = '';

    for (let p = 1; p <= count; p++) {
      const meta = PLAYER_META[p];
      const item = document.createElement('span');
      item.className = 'legend-item';
      if (!state.gameOver && state.currentPlayer === p) {
        item.classList.add('is-turn');
      }
      const sw = document.createElement('span');
      sw.className = `legend-swatch ${meta.css}`;
      const lbl = document.createElement('span');
      lbl.textContent = getPlayerLabel(p, true);
      item.appendChild(sw);
      item.appendChild(lbl);
      els.boardLegend.appendChild(item);
    }

    if (state.boardMode === 'obstacle') {
      const obs = document.createElement('span');
      obs.className = 'legend-item';
      obs.textContent = '✕ Batu Rintangan';
      els.boardLegend.appendChild(obs);
    }
  }

  function renderArenaHeaderAndStatus() {
    const modeTitleMap = {
      hvb: 'ARENA 2P AI',
      pvp: 'PEMAIN VS PEMAIN',
      '4p': 'ARENA 4-PLAYER',
      bvb: 'BOT VS BOT',
    };
    const obsLabel = state.boardMode === 'obstacle' ? ' • OBSTACLE' : '';
    els.arenaPill.textContent = `${modeTitleMap[state.gameMode]}${obsLabel}`;

    els.bvbBar.style.display = isAllBots() && !state.gameOver ? 'flex' : 'none';
    els.autoPlayBtn.textContent = state.autoPlayPaused ? 'Lanjut Auto-Play' : 'Jeda Auto-Play';

    els.turnCounterBadge.textContent = `#${state.moveCount}`;
    els.undoBtn.disabled = state.history.length === 0 || state.isThinking;

    if (state.lastAiResult) {
      els.lastMovePill.style.display = 'inline-block';
      els.lastMovePill.textContent = `Kol ${state.lastAiResult.bestCol} (${formatScore(state.lastAiResult.bestScore)})`;
    } else {
      els.lastMovePill.style.display = 'none';
    }

    renderBoardLegend();

    const activeMeta = PLAYER_META[state.currentPlayer] || PLAYER_META[1];
    els.statusBanner.className = 'status-banner';
    els.statusDot.className = 'status-dot';
    els.thinkingDots.classList.remove('active');

    if (state.gameOver) {
      if (state.winner === 'DRAW') {
        els.statusBanner.classList.add('game-draw');
        els.statusDot.classList.add('neutral');
        els.statusText.textContent = 'Permainan Berakhir SERI (Papan Penuh)';
      } else {
        const winMeta = PLAYER_META[state.winner] || PLAYER_META[1];
        els.statusBanner.classList.add('game-win');
        els.statusDot.classList.add(winMeta.css);
        els.statusText.textContent = `${getPlayerLabel(state.winner, false)} MENANG!`;
      }
      return;
    }

    els.statusBanner.classList.add(`turn-${activeMeta.css}`);
    els.statusDot.classList.add(activeMeta.css);

    if (state.isThinking) {
      els.statusText.textContent = `${getPlayerLabel(state.currentPlayer, true)} sedang berpikir`;
      els.thinkingDots.classList.add('active');
      return;
    }

    const prefix = state.moveCount === 0 && state.randomStartNote ? `${state.randomStartNote} ` : '';
    const cols = state.board[0].length;
    if (isBotPlayer(state.currentPlayer)) {
      els.statusText.textContent = `${prefix}Giliran ${getPlayerLabel(state.currentPlayer, true)}...`;
    } else {
      els.statusText.textContent = `${prefix}Giliran ${getPlayerLabel(state.currentPlayer, false)} — Kolom 0–${cols - 1}`;
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

    els.postGameBanner.className = 'postgame-banner';
    if (state.winner === 'DRAW') {
      els.postGameBanner.classList.add('is-draw');
      els.postGameTitle.textContent = 'Hasil Akhir: SERI!';
      els.postGameSub.textContent = `Papan penuh setelah ${state.moveCount} langkah tanpa 4-in-a-row.`;
    } else {
      const winnerIsBot = isBotPlayer(state.winner);
      if (winnerIsBot && state.gameMode === 'hvb') {
        els.postGameBanner.classList.add('is-bot-win');
      }
      els.postGameTitle.textContent = `${getPlayerLabel(state.winner, false)} Menang!`;
      els.postGameSub.textContent = `4 bidak terhubung dalam total ${state.moveCount} langkah (${getPlayerCount()}-Player).`;
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

    const pCount = getPlayerCount();
    const evalPiece = state.winner && state.winner !== 'DRAW' ? state.winner : (state.compareTarget ? state.compareTarget.aiPiece : AI);
    const finalInfo = AI_LIB.analyzeBoard(state.board, evalPiece, pCount);
    els.legendTotalBadge.textContent = `Total (P${evalPiece}): ${formatScore(finalInfo.totalScore)}`;
    renderScoringLegend(els.heuristicGrid, finalInfo, state.winner, evalPiece);

    if (state.compareTarget) {
      els.compareContextText.textContent =
        `Bandingkan jumlah node pada langkah #${state.compareTarget.step} sebelum penutup (mode ${pCount}P).`;
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

    const pCount = getPlayerCount();
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
      aiPiece: player,
      playerCount: pCount,
      step: state.moveCount,
    };

    const isBot = isBotPlayer(player);
    const actor = getPlayerLabel(player, true);
    const scoreText = aiResult
      ? formatScore(aiResult.bestScore)
      : formatScore(AI_LIB.evaluateBoard(state.board, player, pCount));

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

    state.currentPlayer = AI_LIB.getNextPlayer(player, pCount);
    renderAll(false);
    return true;
  }

  function handleHumanMove(col) {
    if (state.view !== 'game' || state.gameOver || state.isThinking) return;
    if (isBotPlayer(state.currentPlayer)) return;
    if (!AI_LIB.isValidLocation(state.board, col)) return;

    const moved = executeDrop(col, state.currentPlayer, null);
    if (moved && !state.gameOver && isBotPlayer(state.currentPlayer)) {
      scheduleBotTurn(80);
    }
  }

  function scheduleBotTurn(delayMs = 80) {
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
    }, delayMs);
  }

  async function runSingleBotStep(expectedGen = state.matchGeneration) {
    if (state.gameOver || expectedGen !== state.matchGeneration) return;
    const piece = state.currentPlayer;
    if (!isBotPlayer(piece)) return;

    const pCount = getPlayerCount();
    state.isThinking = true;
    renderArenaHeaderAndStatus();

    const boardCopy = AI_LIB.cloneBoard(state.board);
    let res;
    if (state.gameMode === 'bvb' && piece === HUMAN) {
      res = await requestBotMove(boardCopy, {
        difficulty: 'Medium',
        aiPiece: HUMAN,
        usePruning: false,
        customDepth: 3,
        playerCount: pCount,
      });
    } else {
      const cfg = getAiConfig();
      res = await requestBotMove(boardCopy, {
        difficulty: cfg.difficulty,
        aiPiece: piece,
        usePruning: cfg.usePruning,
        customDepth: cfg.difficulty === 'Custom' ? cfg.maxDepth : undefined,
        playerCount: pCount,
      });
    }

    if (expectedGen !== state.matchGeneration || state.gameOver) {
      state.isThinking = false;
      return;
    }

    state.isThinking = false;
    if (res && res.bestCol !== -1) {
      const dropped = executeDrop(res.bestCol, piece, res);
      if (dropped && !state.gameOver && !isAllBots() && isBotPlayer(state.currentPlayer)) {
        scheduleBotTurn(320);
      }
    } else {
      renderArenaHeaderAndStatus();
    }
  }

  async function startAutoPlayLoop() {
    if (!isAllBots() || state.gameOver) return;
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

    const dims = (AI_LIB.BOARD_SIZES && AI_LIB.BOARD_SIZES[state.boardSize]) || { rows: ROWS, cols: COLS };
    const setup = AI_LIB.createSpecialSetup(state.boardMode, dims.rows, dims.cols);
    state.board = setup.board;

    const pCount = getPlayerCount();
    if (state.firstChoice === 'random') {
      state.resolvedFirstPlayer = 1 + Math.floor(Math.random() * pCount);
      state.randomStartNote = `[Acak: ${getPlayerLabel(state.resolvedFirstPlayer, true)}]`;
    } else {
      const parsed = Number(state.firstChoice);
      state.resolvedFirstPlayer = parsed >= 1 && parsed <= pCount ? parsed : 1;
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

    if (isAllBots()) {
      startAutoPlayLoop();
    } else if (isBotPlayer(state.currentPlayer)) {
      scheduleBotTurn(120);
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

    if (!isAllBots() && Object.values(getSeatRoles()).includes('human')) {
      let targetIdx = state.history.length - 1;
      while (targetIdx > 0 && isBotPlayer(state.history[targetIdx].currentPlayer)) {
        targetIdx--;
      }
      const snap = state.history[targetIdx];
      state.history = state.history.slice(0, targetIdx);
      restoreSnapshot(snap);
      renderAll(false);
      if (isBotPlayer(state.currentPlayer) && !state.gameOver) {
        scheduleBotTurn(120);
      }
    } else {
      state.autoPlayPaused = true;
      const snap = state.history.pop();
      restoreSnapshot(snap);
      renderAll(false);
    }
  }

  function toggleAutoPlay() {
    if (!isAllBots() || state.gameOver) return;
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
    const comp = await requestCompare(target.board, depth, target.aiPiece, target.playerCount || getPlayerCount());
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
      const nextMode = btn.dataset.mode;
      if (!state.userPickedSize) {
        state.boardSize = nextMode === '4p' ? '7x9' : '6x7';
      }
      state.gameMode = nextMode;
      syncMenuUI();
      pulsePickedCard(btn);
    });

    if (els.fourPresetGrid) {
      els.fourPresetGrid.addEventListener('click', (e) => {
        const chip = e.target.closest('.preset-chip');
        if (!chip) return;
        const preset = FOUR_PRESETS[chip.dataset.preset];
        if (!preset) return;
        state.fourSeats = { ...preset };
        syncMenuUI();
      });
    }

    if (els.fourSeatsGrid) {
      els.fourSeatsGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.seat-btn');
        if (!btn) return;
        const seat = Number(btn.dataset.seat);
        state.fourSeats[seat] = state.fourSeats[seat] === 'bot' ? 'human' : 'bot';
        syncMenuUI();
        pulsePickedCard(btn);
      });
    }

    els.boardModeGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      state.boardMode = btn.dataset.bmode;
      syncMenuUI();
      pulsePickedCard(btn);
    });

    if (els.boardSizeGrid) {
      els.boardSizeGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.size-btn');
        if (!btn) return;
        state.boardSize = btn.dataset.size;
        state.userPickedSize = true;
        syncMenuUI();
        pulsePickedCard(btn);
      });
    }

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
      if (isAllBots() && !state.gameOver && !state.isThinking) {
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
      renderScoringLegend(els.modalLegendList, null, null, AI);
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
      const maxColKey = String(state.board[0].length - 1);
      if (e.key >= '0' && e.key <= maxColKey) {
        handleHumanMove(Number(e.key));
      }
    });
  }

  syncMenuUI();
  bindEvents();
  switchView('home');
})();
