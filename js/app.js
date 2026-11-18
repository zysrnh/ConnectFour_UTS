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
    difficulty: 'Medium', // 'Easy' | 'Medium' | 'Hard' | 'Custom'
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
    isAnimatingDrop: false,
    autoPlayPaused: false,
    matchGeneration: 0,
    autoPlayTimer: null,
    pendingBotTimer: null,
    postGameTimer: null,
    dropTimer: null,
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

    // UI Presentation Helpers (Lobby Preview, Drawer, Effects, Tabs, Overflow)
    lobbyPreviewBoard: document.getElementById('lobbyPreviewBoard'),
    lobbyPreviewLabel: document.getElementById('lobbyPreviewLabel'),
    lobbyPreviewChips: document.getElementById('lobbyPreviewChips'),
    openAdvancedBtn: document.getElementById('openAdvancedBtn'),
    closeAdvancedBtn: document.getElementById('closeAdvancedBtn'),
    applyAdvancedBtn: document.getElementById('applyAdvancedBtn'),
    advancedSummaryBadge: document.getElementById('advancedSummaryBadge'),
    advancedSetupDetails: document.getElementById('advancedSetupDetails'),
    arenaOverflowMenu: document.getElementById('arenaOverflowMenu'),
    botSpeedSelect: document.getElementById('botSpeedSelect'),
    analysisTabSteps: document.getElementById('analysisTabSteps'),
    analysisTabEfficiency: document.getElementById('analysisTabEfficiency'),
    helpPanelRules: document.getElementById('helpPanelRules'),
    helpPanelAi: document.getElementById('helpPanelAi'),
    winLineSvg: document.getElementById('winLineSvg'),
    confettiCanvas: document.getElementById('confettiCanvas'),
    soundToggleBtn: document.getElementById('soundToggleBtn'),
    sfxVolumeSlider: document.getElementById('sfxVolumeSlider'),
    pwaInstallBtn: document.getElementById('pwaInstallBtn'),
    pwaUpdateToast: document.getElementById('pwaUpdateToast'),
    pwaReloadBtn: document.getElementById('pwaReloadBtn'),
    boardDustLayer: document.getElementById('boardDustLayer'),
    pwaBanner: document.getElementById('pwaBanner'),
    pwaBannerInstallBtn: document.getElementById('pwaBannerInstallBtn'),
    pwaBannerCloseBtn: document.getElementById('pwaBannerCloseBtn'),
    pwaGuideModal: document.getElementById('pwaGuideModal'),
    closePwaGuideBtn: document.getElementById('closePwaGuideBtn'),
    confirmPwaGuideBtn: document.getElementById('confirmPwaGuideBtn'),
    pwaInAppAlert: document.getElementById('pwaInAppAlert'),
    pwaGuideAndroid: document.getElementById('pwaGuideAndroid'),
    pwaGuideIos: document.getElementById('pwaGuideIos'),
    pwaGuideDesktop: document.getElementById('pwaGuideDesktop'),
    menuInstallPwaBtn: document.getElementById('menuInstallPwaBtn'),
    menuTestPwaToastBtn: document.getElementById('menuTestPwaToastBtn'),
  };

  // =========================================================================
  // GAME-FEEL PRESENTATION HELPERS (SYNTHESIZED SFX, HAPTICS, DUST, SHAKE)
  // =========================================================================

  const SFX_STORAGE_KEY = 'connect4_sfx_enabled';
  const SFX_VOLUME_KEY = 'connect4_sfx_volume';
  let sfxEnabled = true;
  let sfxVolume = 0.6;
  let audioCtx = null;
  let masterGain = null;
  let masterCompressor = null;
  let activeVoices = 0;
  const MAX_VOICES = 4;
  let lastTurnSignature = '';
  let viewLeaveTimer = null;
  let activeConfettiRaf = null;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedSfx = window.localStorage.getItem(SFX_STORAGE_KEY);
      if (storedSfx !== null) {
        sfxEnabled = storedSfx === 'true';
      }
      const storedVol = window.localStorage.getItem(SFX_VOLUME_KEY);
      if (storedVol !== null) {
        const v = parseFloat(storedVol);
        if (!isNaN(v) && v >= 0 && v <= 1) sfxVolume = v;
      }
    }
  } catch (_) {}

  function prefersReducedMotion() {
    try {
      return Boolean(
        typeof window !== 'undefined'
        && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      );
    } catch (_) {
      return false;
    }
  }

  function syncSoundToggleUI() {
    if (!els.soundToggleBtn) return;
    if (els.soundToggleBtn.classList) {
      els.soundToggleBtn.classList.toggle('is-active', sfxEnabled);
    }
    if (typeof els.soundToggleBtn.setAttribute === 'function') {
      els.soundToggleBtn.setAttribute('aria-pressed', String(sfxEnabled));
      els.soundToggleBtn.setAttribute(
        'aria-label',
        sfxEnabled ? 'Matikan suara efek game' : 'Aktifkan suara efek game'
      );
    }
    els.soundToggleBtn.title = sfxEnabled ? 'Suara efek: Nyala' : 'Suara efek: Mati';
    if (els.sfxVolumeSlider) {
      els.sfxVolumeSlider.value = String(Math.round(sfxVolume * 100));
    }
  }

  function setSfxVolume(vol) {
    sfxVolume = Math.max(0, Math.min(1, vol));
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SFX_VOLUME_KEY, String(sfxVolume));
      }
    } catch (_) {}
    if (masterGain && audioCtx) {
      masterGain.gain.setValueAtTime(sfxVolume, audioCtx.currentTime);
    }
  }

  function toggleSoundEnabled() {
    sfxEnabled = !sfxEnabled;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(SFX_STORAGE_KEY, String(sfxEnabled));
      }
    } catch (_) {}
    syncSoundToggleUI();
    if (sfxEnabled) playSfx('click');
  }

  function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
      masterCompressor = audioCtx.createDynamicsCompressor();
      masterCompressor.threshold.setValueAtTime(-18, audioCtx.currentTime);
      masterCompressor.knee.setValueAtTime(12, audioCtx.currentTime);
      masterCompressor.ratio.setValueAtTime(8, audioCtx.currentTime);
      masterCompressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
      masterCompressor.release.setValueAtTime(0.2, audioCtx.currentTime);

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(sfxVolume, audioCtx.currentTime);

      masterCompressor.connect(masterGain);
      masterGain.connect(audioCtx.destination);
    } catch (_) {
      return null;
    }
    return audioCtx;
  }

  function resumeAudioOnGesture() {
    const ctx = ensureAudioContext();
    if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume();
    }
  }

  function playSfx(kind, params = {}) {
    if (!sfxEnabled) return;
    const ctx = ensureAudioContext();
    if (!ctx || !masterCompressor) return;
    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume();
      }
      if (activeVoices >= MAX_VOICES && kind === 'hover') return;

      const now = ctx.currentTime;
      activeVoices++;
      const releaseVoice = (delaySec) => {
        setTimeout(() => { activeVoices = Math.max(0, activeVoices - 1); }, Math.round(delaySec * 1000));
      };

      if (kind === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(680, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.035);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(masterCompressor);
        osc.start(now);
        osc.stop(now + 0.045);
        releaseVoice(0.05);
      } else if (kind === 'hover') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.025, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
        osc.connect(gain);
        gain.connect(masterCompressor);
        osc.start(now);
        osc.stop(now + 0.03);
        releaseVoice(0.035);
      } else if (kind === 'whoosh') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(95, now + 0.12);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.connect(gain);
        gain.connect(masterCompressor);
        osc.start(now);
        osc.stop(now + 0.14);
        releaseVoice(0.15);
      } else if (kind === 'thud') {
        const row = typeof params.row === 'number' ? params.row : 3;
        const maxRows = typeof params.maxRows === 'number' ? params.maxRows : 6;
        const depthRatio = Math.min(1, Math.max(0, row / (maxRows - 1 || 1)));
        const baseFreq = Math.round(115 - depthRatio * 45);
        const vol = 0.16 + depthRatio * 0.10;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.08);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(masterCompressor);
        osc.start(now);
        osc.stop(now + 0.095);

        const bounceOsc = ctx.createOscillator();
        const bounceGain = ctx.createGain();
        const bNow = now + 0.068;
        bounceOsc.type = 'sine';
        bounceOsc.frequency.setValueAtTime(baseFreq * 1.25, bNow);
        bounceOsc.frequency.exponentialRampToValueAtTime(50, bNow + 0.05);
        bounceGain.gain.setValueAtTime(vol * 0.38, bNow);
        bounceGain.gain.exponentialRampToValueAtTime(0.001, bNow + 0.055);
        bounceOsc.connect(bounceGain);
        bounceGain.connect(masterCompressor);
        bounceOsc.start(bNow);
        bounceOsc.stop(bNow + 0.06);

        releaseVoice(0.14);
      } else if (kind === 'botTurn') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(460, now);
        osc.frequency.setValueAtTime(620, now + 0.04);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
        osc.connect(gain);
        gain.connect(masterCompressor);
        osc.start(now);
        osc.stop(now + 0.09);
        releaseVoice(0.1);
      } else if (kind === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const t0 = now + idx * 0.075;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t0);
          gain.gain.setValueAtTime(0.12, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
          osc.connect(gain);
          gain.connect(masterCompressor);
          osc.start(t0);
          osc.stop(t0 + 0.23);
        });
        releaseVoice(0.5);
      } else if (kind === 'lose') {
        const notes = [440, 392, 349.23, 293.66];
        notes.forEach((freq, idx) => {
          const t0 = now + idx * 0.085;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t0);
          gain.gain.setValueAtTime(0.10, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.20);
          osc.connect(gain);
          gain.connect(masterCompressor);
          osc.start(t0);
          osc.stop(t0 + 0.21);
        });
        releaseVoice(0.45);
      } else if (kind === 'draw') {
        [349.23, 440].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
          osc.connect(gain);
          gain.connect(masterCompressor);
          osc.start(now);
          osc.stop(now + 0.28);
        });
        releaseVoice(0.3);
      } else if (kind === 'undo') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(560, now + 0.08);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain);
        gain.connect(masterCompressor);
        osc.start(now);
        osc.stop(now + 0.095);
        releaseVoice(0.1);
      }
    } catch (_) {}
  }

  function triggerHaptic(type, arg) {
    if (!sfxEnabled) return;
    try {
      if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.vibrate === 'function') {
        if (type === 'drop') {
          const row = typeof arg === 'number' ? arg : 3;
          window.navigator.vibrate(Math.min(35, 12 + row * 3));
        } else if (type === 'win') {
          window.navigator.vibrate([40, 50, 70]);
        }
      }
    } catch (_) {}
  }

  function triggerBoardImpact(row, col) {
    if (prefersReducedMotion() || !els.boardGrid) return;
    const shakePx = Math.min(2.5, 0.8 + row * 0.22);
    els.boardGrid.style.setProperty('--shake-px', `${shakePx}px`);
    els.boardGrid.classList.remove('board-impact');
    if (typeof els.boardGrid.offsetWidth === 'number') void els.boardGrid.offsetWidth;
    els.boardGrid.classList.add('board-impact');
    setTimeout(() => {
      if (els.boardGrid && els.boardGrid.classList) {
        els.boardGrid.classList.remove('board-impact');
      }
    }, 180);

    if (els.colSelectors && els.colSelectors.children && els.colSelectors.children[col]) {
      const colBtn = els.colSelectors.children[col];
      colBtn.classList.remove('col-landing-flash');
      if (typeof colBtn.offsetWidth === 'number') void colBtn.offsetWidth;
      colBtn.classList.add('col-landing-flash');
      setTimeout(() => {
        if (colBtn && colBtn.classList) colBtn.classList.remove('col-landing-flash');
      }, 220);
    }
  }

  function createLandingDust(row, col) {
    if (prefersReducedMotion() || !els.boardDustLayer) return;
    const cols = state.board && state.board[0] ? state.board[0].length : 7;
    const rows = state.board ? state.board.length : 6;
    const burst = document.createElement('div');
    burst.className = 'dust-burst';
    const leftPct = ((col + 0.5) / cols) * 100;
    const topPct = ((row + 0.95) / rows) * 100;
    burst.style.left = `${leftPct}%`;
    burst.style.top = `${topPct}%`;

    for (let i = 0; i < 5; i++) {
      const p = document.createElement('span');
      p.className = 'dust-particle';
      const angle = (Math.PI / 6) + (Math.random() * (2 * Math.PI / 3));
      const dist = 12 + Math.random() * 16;
      p.style.setProperty('--dx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
      p.style.setProperty('--dy', `${(-Math.sin(angle) * dist).toFixed(1)}px`);
      burst.appendChild(p);
    }
    els.boardDustLayer.appendChild(burst);
    setTimeout(() => {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 280);
  }

  function getBotSpeedFactor() {
    const mode = els.botSpeedSelect ? els.botSpeedSelect.value : 'normal';
    if (mode === 'fast') return 0.35;
    if (mode === 'slow') return 2.2;
    return 1;
  }

  function closeOverflowMenu() {
    if (els.arenaOverflowMenu) {
      els.arenaOverflowMenu.open = false;
    }
  }

  function switchHelpTab(tabName = 'rules') {
    const isAi = tabName === 'ai';
    if (els.helpPanelRules) els.helpPanelRules.style.display = isAi ? 'none' : 'flex';
    if (els.helpPanelAi) els.helpPanelAi.style.display = isAi ? 'flex' : 'none';
    if (els.rulesModal && els.rulesModal.querySelectorAll) {
      els.rulesModal.querySelectorAll('[data-help-tab]').forEach((btn) => {
        const active = btn.dataset.helpTab === tabName;
        btn.classList.toggle('active', active);
        if (typeof btn.setAttribute === 'function') btn.setAttribute('aria-selected', String(active));
      });
    }
    if (isAi) {
      renderScoringLegend(els.modalLegendList, null, null, AI);
    }
  }

  function switchAnalysisTab(tabName = 'steps') {
    const isEff = tabName === 'efficiency';
    if (els.analysisTabSteps) els.analysisTabSteps.style.display = isEff ? 'none' : 'flex';
    if (els.analysisTabEfficiency) els.analysisTabEfficiency.style.display = isEff ? 'flex' : 'none';
    if (els.postGamePanel && els.postGamePanel.querySelectorAll) {
      els.postGamePanel.querySelectorAll('[data-analysis-tab]').forEach((btn) => {
        const active = btn.dataset.analysisTab === tabName;
        btn.classList.toggle('active', active);
        if (typeof btn.setAttribute === 'function') btn.setAttribute('aria-selected', String(active));
      });
    }
  }

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
      els.firstSectionLabel.textContent = 'Jalan pertama';
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
      hvb: '2P AI',
      pvp: 'PvP 2P',
      '4p': '4P',
      bvb: 'Bot Duel',
    };
    const sizeInfo = (AI_LIB.BOARD_SIZES && AI_LIB.BOARD_SIZES[state.boardSize]) || { label: state.boardSize };
    const obsTag = state.boardMode === 'obstacle' ? ' • Batu' : '';
    const cfg = getAiConfig();
    const diffShort =
      cfg.difficulty === 'Custom'
        ? `Custom d=${cfg.maxDepth}`
        : cfg.difficulty;
    els.setupPreviewBadge.textContent = `${modeTagMap[state.gameMode]} • ${sizeInfo.label}${obsTag}`;
    els.activeConfigBadge.textContent = `${modeTagMap[state.gameMode]}${botsPresent ? ` • ${diffShort}` : ''} • ${sizeInfo.label}${obsTag}`;

    syncAdvancedSummary(botsPresent, is4P, cfg);
    renderLobbyPreview();
  }

  function syncAdvancedSummary(botsPresent, is4P, cfg) {
    if (!els.advancedSummaryBadge) return;
    const firstMap = {
      '1': is4P ? 'P1' : (state.gameMode === 'hvb' ? 'Manusia' : 'P1'),
      '2': is4P ? 'P2' : (state.gameMode === 'hvb' ? 'Bot AI' : 'P2'),
      '3': 'P3',
      '4': 'P4',
      random: 'Acak',
    };
    const parts = [];
    if (is4P) {
      let humanCount = 0;
      for (let s = 1; s <= 4; s++) {
        if (state.fourSeats[s] === 'human') humanCount += 1;
      }
      parts.push(`${humanCount}P+${4 - humanCount}B`);
    }
    if (botsPresent && cfg && cfg.difficulty === 'Custom') {
      parts.push(`${cfg.algorithm === 'minimax' ? 'MM' : 'AB'} d=${cfg.maxDepth}`);
    }
    parts.push(`Jalan: ${firstMap[state.firstChoice] || 'P1'}`);
    els.advancedSummaryBadge.textContent = parts.join(' • ');
  }

  function renderLobbyPreview() {
    if (!els.lobbyPreviewBoard) return;
    const sizeInfo = (AI_LIB.BOARD_SIZES && AI_LIB.BOARD_SIZES[state.boardSize]) || { rows: 6, cols: 7, label: '6×7' };
    const rows = sizeInfo.rows;
    const cols = sizeInfo.cols;
    const isObs = state.boardMode === 'obstacle';
    const pCount = getPlayerCount();

    if (els.lobbyPreviewLabel) {
      els.lobbyPreviewLabel.textContent = `${isObs ? 'Obstacle' : 'Klasik'} • ${sizeInfo.label}`;
    }

    if (els.lobbyPreviewChips) {
      els.lobbyPreviewChips.innerHTML = '';
      for (let p = 1; p <= pCount; p++) {
        const meta = PLAYER_META[p];
        const chip = document.createElement('span');
        chip.className = 'pv-chip';
        chip.innerHTML = `<span class="pv-dot ${meta.css}"></span><span>P${p}</span>`;
        els.lobbyPreviewChips.appendChild(chip);
      }
      if (isObs) {
        const obsChip = document.createElement('span');
        obsChip.className = 'pv-chip';
        obsChip.innerHTML = `<span class="pv-dot obs"></span><span>Batu</span>`;
        els.lobbyPreviewChips.appendChild(obsChip);
      }
    }

    if (els.lobbyPreviewBoard.style) {
      els.lobbyPreviewBoard.style.setProperty('--p-rows', String(rows));
      els.lobbyPreviewBoard.style.setProperty('--p-cols', String(cols));
    }

    const previewMap = new Map();
    if (isObs) {
      const stones = [
        [rows - 2, 1],
        [rows - 2, cols - 2],
        [Math.floor(rows / 2), Math.floor(cols / 2)],
        [Math.floor(rows / 2) - 1, Math.floor(cols / 2) - 1],
      ];
      stones.forEach(([sr, sc]) => {
        if (sr >= 0 && sr < rows && sc >= 0 && sc < cols) {
          previewMap.set(`${sr},${sc}`, 'is-stone');
        }
      });
    }

    const sampleDiscs = pCount === 4
      ? [
          [rows - 1, 0, 'p1'],
          [rows - 1, 2, 'p2'],
          [rows - 1, 4, 'p3'],
          [rows - 1, cols - 1, 'p4'],
          [rows - 2, 2, 'p1'],
          [rows - 2, 4, 'p2'],
        ]
      : [
          [rows - 1, Math.floor(cols / 2) - 1, 'p1'],
          [rows - 1, Math.floor(cols / 2), 'p2'],
          [rows - 1, Math.floor(cols / 2) + 1, 'p1'],
          [rows - 2, Math.floor(cols / 2), 'p1'],
          [rows - 2, Math.floor(cols / 2) - 1, 'p2'],
        ];
    sampleDiscs.forEach(([dr, dc, cls]) => {
      const key = `${dr},${dc}`;
      if (dr >= 0 && dr < rows && dc >= 0 && dc < cols && !previewMap.has(key)) {
        previewMap.set(key, cls);
      }
    });

    els.lobbyPreviewBoard.innerHTML = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        const extra = previewMap.get(`${r},${c}`) || '';
        cell.className = extra ? `p-cell ${extra}` : 'p-cell';
        els.lobbyPreviewBoard.appendChild(cell);
      }
    }
  }

  function openAdvancedDrawer() {
    if (!els.advancedSetupDetails) return;
    openModal(els.advancedSetupDetails);
    els.advancedSetupDetails.open = true;
  }

  function closeAdvancedDrawer() {
    if (!els.advancedSetupDetails) return;
    els.advancedSetupDetails.open = false;
    closeModal(els.advancedSetupDetails);
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
    if (state.dropTimer) {
      clearTimeout(state.dropTimer);
      state.dropTimer = null;
    }
    state.isThinking = false;
    state.isAnimatingDrop = false;
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
    const prevName = state.view;
    const viewMap = {
      home: els.homeView,
      setup: els.setupView,
      game: els.gameView,
    };
    const nextEl = viewMap[viewName];
    const prevEl = viewMap[prevName];

    if (viewLeaveTimer) {
      clearTimeout(viewLeaveTimer);
      viewLeaveTimer = null;
    }

    state.view = viewName;

    Object.entries(viewMap).forEach(([name, el]) => {
      if (!el) return;
      if (el.classList) el.classList.remove('view-entering', 'view-leaving');
      if (name !== viewName && name !== prevName) {
        el.style.display = 'none';
      }
    });

    if (nextEl) {
      nextEl.style.display = viewName === 'game' ? 'block' : 'flex';
      if (prevName !== viewName && !prefersReducedMotion() && nextEl.classList) {
        nextEl.classList.add('view-entering');
      }
    }

    if (prevEl && prevEl !== nextEl) {
      if (!prefersReducedMotion() && prevEl.classList && typeof window !== 'undefined' && window.document && window.document.body) {
        prevEl.classList.add('view-leaving');
        viewLeaveTimer = setTimeout(() => {
          viewLeaveTimer = null;
          if (state.view !== prevName) {
            prevEl.style.display = 'none';
            prevEl.classList.remove('view-leaving');
          }
        }, 180);
      } else {
        prevEl.style.display = 'none';
      }
    }

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

    if (els.arenaShell && els.arenaShell.classList) {
      els.arenaShell.classList.toggle('is-wide-arena', getPlayerCount() >= 4 || cols >= 8);
    }
    if (els.hoverPreviewRow && els.hoverPreviewRow.classList) {
      els.hoverPreviewRow.classList.toggle('is-idle', !humanCanClick);
    }

    [els.arenaShell, els.hoverPreviewRow, els.colSelectors, els.boardGrid].forEach((el) => {
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
      btn.textContent = String(c);
      btn.title = `Kolom ${c} (tekan ${c})`;
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
              if (state.lastMove.duration) {
                disc.style.setProperty('--drop-duration', `${state.lastMove.duration}ms`);
              }
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
    renderWinLineOverlay();
  }

  function renderWinLineOverlay() {
    if (!els.winLineSvg) return;
    els.winLineSvg.innerHTML = '';
    if (!state.gameOver || !state.winCells || state.winCells.length < 2) return;
    if (typeof document === 'undefined' || typeof document.createElementNS !== 'function') return;

    const cols = state.board[0].length;
    const rows = state.board.length;
    const first = state.winCells[0];
    const last = state.winCells[state.winCells.length - 1];
    const firstCell = els.boardGrid.children[first[0] * cols + first[1]];
    const lastCell = els.boardGrid.children[last[0] * cols + last[1]];

    const svgNS = 'http://www.w3.org/2000/svg';
    const w = els.boardGrid.clientWidth || 0;
    const h = els.boardGrid.clientHeight || 0;
    let x1;
    let y1;
    let x2;
    let y2;

    if (w > 0 && h > 0 && firstCell && lastCell && typeof firstCell.offsetLeft === 'number') {
      els.winLineSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      x1 = firstCell.offsetLeft + firstCell.offsetWidth / 2;
      y1 = firstCell.offsetTop + firstCell.offsetHeight / 2;
      x2 = lastCell.offsetLeft + lastCell.offsetWidth / 2;
      y2 = lastCell.offsetTop + lastCell.offsetHeight / 2;
    } else {
      els.winLineSvg.setAttribute('viewBox', '0 0 100 100');
      x1 = ((first[1] + 0.5) / cols) * 100;
      y1 = ((first[0] + 0.5) / rows) * 100;
      x2 = ((last[1] + 0.5) / cols) * 100;
      y2 = ((last[0] + 0.5) / rows) * 100;
    }

    const glow = document.createElementNS(svgNS, 'line');
    glow.setAttribute('x1', String(x1));
    glow.setAttribute('y1', String(y1));
    glow.setAttribute('x2', String(x2));
    glow.setAttribute('y2', String(y2));
    glow.setAttribute('class', 'win-beam-glow');

    const core = document.createElementNS(svgNS, 'line');
    core.setAttribute('x1', String(x1));
    core.setAttribute('y1', String(y1));
    core.setAttribute('x2', String(x2));
    core.setAttribute('y2', String(y2));
    core.setAttribute('class', 'win-beam-core');

    els.winLineSvg.appendChild(glow);
    els.winLineSvg.appendChild(core);
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
    if (col >= 0 && !state.gameOver && !state.isThinking && !state.isAnimatingDrop && !isBotPlayer(state.currentPlayer)) {
      playSfx('hover');
    }
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
    els.autoPlayBtn.textContent = state.autoPlayPaused ? 'Lanjut auto-play' : 'Jeda auto-play';

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
    els.statusBanner.className = 'turn-pill';
    els.statusDot.className = 'status-dot';
    els.thinkingDots.classList.remove('active');

    if (state.gameOver) {
      if (state.winner === 'DRAW') {
        els.statusBanner.classList.add('game-draw');
        els.statusDot.classList.add('neutral');
        els.statusText.textContent = 'Permainan seri';
      } else {
        const winMeta = PLAYER_META[state.winner] || PLAYER_META[1];
        els.statusBanner.classList.add('game-win');
        els.statusDot.classList.add(winMeta.css);
        els.statusText.textContent = `${getPlayerLabel(state.winner, true)} menang`;
      }
      return;
    }

    els.statusBanner.classList.add(`turn-${activeMeta.css}`);
    els.statusDot.classList.add(activeMeta.css);

    if (state.isThinking) {
      els.statusText.textContent = `${getPlayerLabel(state.currentPlayer, true)} berpikir`;
      els.thinkingDots.classList.add('active');
      return;
    }

    if (state.gameMode === 'hvb' && state.currentPlayer === HUMAN) {
      els.statusText.textContent = 'Giliran Anda';
    } else {
      els.statusText.textContent = `Giliran ${getPlayerLabel(state.currentPlayer, true)}`;
    }

    pulseTurnBanner(`${state.gameOver ? state.winner : state.currentPlayer}-${state.isThinking ? 'wait' : 'ready'}`);
  }

  function pulseTurnBanner(sig) {
    if (sig === lastTurnSignature) return;
    lastTurnSignature = sig;
    if (!els.statusBanner || !els.statusBanner.classList || prefersReducedMotion()) return;
    els.statusBanner.classList.remove('turn-chip-pop');
    if (typeof els.statusBanner.offsetWidth === 'number') {
      void els.statusBanner.offsetWidth;
    }
    els.statusBanner.classList.add('turn-chip-pop');
  }

  function renderPostGameAnalysis(showPanel) {
    if (!showPanel || !state.gameOver) {
      els.arenaShell.classList.remove('has-analysis');
      els.postGamePanel.style.display = 'none';
      return;
    }

    els.arenaShell.classList.add('has-analysis');
    els.postGamePanel.style.display = 'flex';

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

    animateCountUp(els.statTotalMoves, state.moveCount, (n) => String(Math.round(n)));
    animateCountUp(els.statBotMoves, botEntries.length, (n) => String(Math.round(n)));
    animateCountUp(els.statAvgNodes, avgNodes, (n) => Math.round(n).toLocaleString('id-ID'));
    els.statTotalTime.textContent = `${totalTime.toFixed(1)} ms`;

    if (state.winner !== 'DRAW') {
      launchConfettiBurst();
    }

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

    // Realistic physics: duration scales with distance (row + 1)
    const dropDistance = row + 1;
    const dropDuration = prefersReducedMotion() ? 60 : Math.round(140 + Math.sqrt(dropDistance) * 75);
    state.isAnimatingDrop = true;
    state.lastMove = { row, col, animate: true, duration: dropDuration };

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

    renderAll(false);
    playSfx('whoosh');

    const totalRows = state.board ? state.board.length : 6;
    const impactTime = prefersReducedMotion() ? 0 : Math.round(dropDuration * 0.68);

    if (impactTime > 0) {
      setTimeout(() => {
        playSfx('thud', { row, maxRows: totalRows });
        triggerBoardImpact(row, col);
        createLandingDust(row, col);
        triggerHaptic('drop', row);
      }, impactTime);
    } else {
      playSfx('thud', { row, maxRows: totalRows });
    }

    if (state.dropTimer) clearTimeout(state.dropTimer);
    state.dropTimer = setTimeout(() => {
      state.dropTimer = null;
      state.isAnimatingDrop = false;

      const winInfo = AI_LIB.getWinnerInfo(state.board);
      if (winInfo.winner !== null) {
        state.gameOver = true;
        state.winner = winInfo.winner;
        state.winCells = winInfo.cells;
        clearTimers();
        renderAll(false);

        if (winInfo.winner === 'DRAW') {
          playSfx('draw');
          if (els.boardGrid && !prefersReducedMotion()) {
            els.boardGrid.classList.add('board-draw-shake');
            setTimeout(() => {
              if (els.boardGrid && els.boardGrid.classList) els.boardGrid.classList.remove('board-draw-shake');
            }, 300);
          }
        } else {
          const humanWon = state.gameMode === 'hvb' ? winInfo.winner === HUMAN : true;
          playSfx(humanWon ? 'win' : 'lose');
          triggerHaptic('win');
        }

        state.postGameTimer = setTimeout(() => {
          state.postGameTimer = null;
          renderPostGameAnalysis(true);
        }, 360);
        return;
      }

      state.currentPlayer = AI_LIB.getNextPlayer(player, pCount);
      renderAll(false);

      if (isBotPlayer(state.currentPlayer) && !state.gameOver) {
        scheduleBotTurn(isAllBots() ? 120 : 180);
      }
    }, dropDuration);

    return true;
  }

  function handleHumanMove(col) {
    if (state.view !== 'game' || state.gameOver || state.isThinking || state.isAnimatingDrop) return;
    if (isBotPlayer(state.currentPlayer)) return;
    if (!AI_LIB.isValidLocation(state.board, col)) return;

    executeDrop(col, state.currentPlayer, null);
  }

  function scheduleBotTurn(delayMs = 80) {
    const gen = state.matchGeneration;
    state.isThinking = true;
    renderArenaHeaderAndStatus();
    applyHoverVisuals();
    playSfx('botTurn');

    state.pendingBotTimer = setTimeout(async () => {
      state.pendingBotTimer = null;
      if (state.gameOver || gen !== state.matchGeneration) {
        state.isThinking = false;
        renderArenaHeaderAndStatus();
        return;
      }
      await runSingleBotStep(gen);
    }, Math.round(delayMs * getBotSpeedFactor()));
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
      executeDrop(res.bestCol, piece, res);
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
        }, Math.round(420 * getBotSpeedFactor()));
      });
    }
  }

  function resetGame() {
    state.matchGeneration += 1;
    clearTimers();
    playSfx('undo');

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

    if (els.compareDepthSelect) {
      els.compareDepthSelect.value = dims.cols >= 10 ? '3' : '4';
    }
    switchAnalysisTab('steps');
    closeOverflowMenu();
    els.compareResult.innerHTML =
      'Tekan tombol di atas untuk membandingkan efisiensi node pencarian.';

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
    closeOverflowMenu();
    switchView('home');
  }

  function goToSetup() {
    state.matchGeneration += 1;
    clearTimers();
    closeOverflowMenu();
    syncMenuUI();
    switchView('setup');
  }

  function undoMove() {
    if (state.history.length === 0 || state.isThinking || state.isAnimatingDrop) return;
    state.matchGeneration += 1;
    clearTimers();
    playSfx('undo');

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

  function animateCountUp(el, targetVal, formatter) {
    if (!el) return;
    if (
      targetVal <= 0
      || prefersReducedMotion()
      || typeof window === 'undefined'
      || typeof window.requestAnimationFrame !== 'function'
    ) {
      el.textContent = formatter(targetVal);
      return;
    }
    const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const duration = 280;
    function step(now) {
      const elapsed = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - elapsed, 3);
      el.textContent = formatter(targetVal * eased);
      if (elapsed < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = formatter(targetVal);
      }
    }
    window.requestAnimationFrame(step);
  }

  function launchConfettiBurst() {
    if (
      !els.confettiCanvas
      || prefersReducedMotion()
      || typeof window === 'undefined'
      || typeof window.requestAnimationFrame !== 'function'
      || typeof els.confettiCanvas.getContext !== 'function'
    ) {
      return;
    }
    const canvas = els.confettiCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (activeConfettiRaf) {
      window.cancelAnimationFrame(activeConfettiRaf);
      activeConfettiRaf = null;
    }
    canvas.width = window.innerWidth || 1280;
    canvas.height = window.innerHeight || 720;

    const palette = ['#fd5a46', '#ffc567', '#00995e', '#552cb7', '#058cd7'];
    const particles = [];
    for (let i = 0; i < 46; i++) {
      particles.push({
        x: (canvas.width * 0.5) + (Math.random() - 0.5) * 260,
        y: canvas.height * 0.25 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 9,
        vy: -Math.random() * 7 - 2,
        w: 8 + Math.random() * 6,
        h: 6 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.22,
        color: palette[i % palette.length],
      });
    }

    const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    function tick(now) {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (elapsed > 1750) {
        activeConfettiRaf = null;
        return;
      }
      const alpha = elapsed > 1250 ? Math.max(0, 1 - (elapsed - 1250) / 500) : 1;
      ctx.globalAlpha = alpha;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.34;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      activeConfettiRaf = window.requestAnimationFrame(tick);
    }
    activeConfettiRaf = window.requestAnimationFrame(tick);
  }

  function bindGridKeyboardNav(containerEl) {
    if (!containerEl || typeof containerEl.addEventListener !== 'function') return;
    containerEl.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      if (!containerEl.querySelectorAll) return;
      const items = Array.from(containerEl.querySelectorAll('button')).filter(
        (b) => !b.disabled && (!b.style || b.style.display !== 'none')
      );
      if (items.length <= 1) return;
      const idx = items.indexOf(e.target);
      if (idx === -1) return;
      e.preventDefault();
      const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      const next = items[(idx + delta + items.length) % items.length];
      if (next && typeof next.focus === 'function') next.focus();
    });
  }

  function bindEvents() {
    if (els.soundToggleBtn) {
      els.soundToggleBtn.addEventListener('click', toggleSoundEnabled);
    }

    if (els.openAdvancedBtn) {
      els.openAdvancedBtn.addEventListener('click', () => {
        playSfx('click');
        openAdvancedDrawer();
      });
    }
    if (els.closeAdvancedBtn) {
      els.closeAdvancedBtn.addEventListener('click', closeAdvancedDrawer);
    }
    if (els.applyAdvancedBtn) {
      els.applyAdvancedBtn.addEventListener('click', () => {
        playSfx('click');
        closeAdvancedDrawer();
      });
    }
    if (els.advancedSetupDetails) {
      els.advancedSetupDetails.addEventListener('click', (e) => {
        if (e.target === els.advancedSetupDetails) closeAdvancedDrawer();
      });
    }

    [
      els.modeChoiceGrid,
      els.boardModeGrid,
      els.boardSizeGrid,
      els.diffChoiceGrid,
      els.firstChoiceGrid,
      els.fourPresetGrid,
      els.fourSeatsGrid,
    ].forEach(bindGridKeyboardNav);

    els.modeChoiceGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      const nextMode = btn.dataset.mode;
      if (!state.userPickedSize) {
        state.boardSize = nextMode === '4p' ? '8x10' : '6x7';
      }
      state.gameMode = nextMode;
      syncMenuUI();
      pulsePickedCard(btn);
      playSfx('click');
      if (nextMode === '4p' && els.openAdvancedBtn && els.openAdvancedBtn.classList) {
        els.openAdvancedBtn.classList.remove('has-highlight');
        if (typeof els.openAdvancedBtn.offsetWidth === 'number') void els.openAdvancedBtn.offsetWidth;
        els.openAdvancedBtn.classList.add('has-highlight');
      }
    });

    if (els.fourPresetGrid) {
      els.fourPresetGrid.addEventListener('click', (e) => {
        const chip = e.target.closest('.preset-chip');
        if (!chip) return;
        const preset = FOUR_PRESETS[chip.dataset.preset];
        if (!preset) return;
        state.fourSeats = { ...preset };
        syncMenuUI();
        playSfx('click');
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
        playSfx('click');
      });
    }

    els.boardModeGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      state.boardMode = btn.dataset.bmode;
      syncMenuUI();
      pulsePickedCard(btn);
      playSfx('click');
    });

    if (els.boardSizeGrid) {
      els.boardSizeGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.size-btn');
        if (!btn) return;
        state.boardSize = btn.dataset.size;
        state.userPickedSize = true;
        syncMenuUI();
        pulsePickedCard(btn);
        playSfx('click');
      });
    }

    els.diffChoiceGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      state.difficulty = btn.dataset.diff;
      syncMenuUI();
      pulsePickedCard(btn);
      playSfx('click');
      if (state.difficulty === 'Custom') {
        openAdvancedDrawer();
      }
    });

    els.firstChoiceGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.choice-card');
      if (!btn) return;
      state.firstChoice = btn.dataset.first;
      syncMenuUI();
      pulsePickedCard(btn);
      playSfx('click');
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

    els.openRulesBtn.addEventListener('click', () => {
      switchHelpTab('rules');
      openModal(els.rulesModal);
    });
    els.closeRulesBtn.addEventListener('click', () => closeModal(els.rulesModal));
    els.rulesModal.addEventListener('click', (e) => {
      if (e.target === els.rulesModal) closeModal(els.rulesModal);
      const helpTabBtn = e.target.closest ? e.target.closest('[data-help-tab]') : null;
      if (helpTabBtn) {
        switchHelpTab(helpTabBtn.dataset.helpTab);
      }
    });

    els.openInfoBtn.addEventListener('click', () => {
      switchHelpTab('ai');
      openModal(els.rulesModal);
    });
    els.closeInfoBtn.addEventListener('click', () => closeModal(els.infoModal));
    els.infoModal.addEventListener('click', (e) => {
      if (e.target === els.infoModal) closeModal(els.infoModal);
    });

    if (els.postGamePanel) {
      els.postGamePanel.addEventListener('click', (e) => {
        const tabBtn = e.target.closest ? e.target.closest('[data-analysis-tab]') : null;
        if (tabBtn) {
          switchAnalysisTab(tabBtn.dataset.analysisTab);
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (els.arenaOverflowMenu && els.arenaOverflowMenu.open) {
        if (!els.arenaOverflowMenu.contains || !els.arenaOverflowMenu.contains(e.target)) {
          closeOverflowMenu();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (els.advancedSetupDetails && els.advancedSetupDetails.style.display === 'flex') {
          closeAdvancedDrawer();
          return;
        }
        if (els.arenaOverflowMenu && els.arenaOverflowMenu.open) {
          closeOverflowMenu();
          return;
        }
        if (els.rulesModal.style.display === 'flex') {
          closeModal(els.rulesModal);
          return;
        }
        if (els.infoModal.style.display === 'flex') {
          closeModal(els.infoModal);
          return;
        }
        if (els.pwaGuideModal && els.pwaGuideModal.style.display === 'flex') {
          closeModal(els.pwaGuideModal);
          return;
        }
      }
      if (state.view !== 'game' || e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
      const maxColKey = String(state.board[0].length - 1);
      if (e.key >= '0' && e.key <= maxColKey) {
        handleHumanMove(Number(e.key));
      }
    });

    // Web Audio first gesture unlock
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      ['click', 'touchstart', 'keydown'].forEach((evt) => {
        window.addEventListener(evt, resumeAudioOnGesture, { once: true, passive: true });
      });
    }

    // Volume Slider in Overflow Menu
    if (els.sfxVolumeSlider) {
      els.sfxVolumeSlider.value = String(Math.round(sfxVolume * 100));
      els.sfxVolumeSlider.addEventListener('input', (e) => {
        const v = Number(e.target.value) / 100;
        setSfxVolume(v);
      });
    }

    // PWA Install & Notifications
    const PWA_DISMISSED_KEY = 'connect4_pwa_banner_dismissed';
    let deferredInstallPrompt = null;

    function switchPwaGuideTab(tabName) {
      if (!els.pwaGuideModal) return;
      const tabBtns = els.pwaGuideModal.querySelectorAll('[data-pwa-tab]');
      tabBtns.forEach(btn => {
        const isActive = btn.dataset.pwaTab === tabName;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      if (els.pwaGuideAndroid) els.pwaGuideAndroid.style.display = tabName === 'android' ? 'block' : 'none';
      if (els.pwaGuideIos) els.pwaGuideIos.style.display = tabName === 'ios' ? 'block' : 'none';
      if (els.pwaGuideDesktop) els.pwaGuideDesktop.style.display = tabName === 'desktop' ? 'block' : 'none';
    }

    function openPwaGuideModal() {
      const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
      const isIos = /iphone|ipad|ipod/i.test(ua);
      const isAndroid = /android/i.test(ua);
      const isInApp = /fban|fbav|instagram|line|micromessenger|whatsapp/i.test(ua);

      if (els.pwaInAppAlert) {
        els.pwaInAppAlert.style.display = isInApp ? 'flex' : 'none';
      }
      if (isIos) {
        switchPwaGuideTab('ios');
      } else if (isAndroid) {
        switchPwaGuideTab('android');
      } else {
        switchPwaGuideTab('desktop');
      }
      openModal(els.pwaGuideModal);
    }

    async function triggerPwaInstallFlow() {
      playSfx('click');
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        try {
          const choice = await deferredInstallPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            if (els.pwaInstallBtn) els.pwaInstallBtn.style.display = 'none';
            if (els.pwaBanner) els.pwaBanner.style.display = 'none';
          }
        } catch (_) {}
        deferredInstallPrompt = null;
      } else {
        openPwaGuideModal();
      }
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (els.pwaInstallBtn) {
          els.pwaInstallBtn.style.display = 'inline-flex';
        }
        let dismissed = false;
        try {
          dismissed = window.localStorage && window.localStorage.getItem(PWA_DISMISSED_KEY) === 'true';
        } catch (_) {}
        if (!dismissed && els.pwaBanner) {
          els.pwaBanner.style.display = 'flex';
        }
      });
    }

    if (els.pwaInstallBtn) {
      els.pwaInstallBtn.addEventListener('click', triggerPwaInstallFlow);
    }

    if (els.pwaBannerInstallBtn) {
      els.pwaBannerInstallBtn.addEventListener('click', triggerPwaInstallFlow);
    }

    if (els.pwaBannerCloseBtn) {
      els.pwaBannerCloseBtn.addEventListener('click', () => {
        playSfx('click');
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(PWA_DISMISSED_KEY, 'true');
          }
        } catch (_) {}
        if (els.pwaBanner) els.pwaBanner.style.display = 'none';
      });
    }

    if (els.closePwaGuideBtn) {
      els.closePwaGuideBtn.addEventListener('click', () => closeModal(els.pwaGuideModal));
    }
    if (els.confirmPwaGuideBtn) {
      els.confirmPwaGuideBtn.addEventListener('click', () => {
        playSfx('click');
        closeModal(els.pwaGuideModal);
      });
    }
    if (els.pwaGuideModal) {
      const pwaTabs = els.pwaGuideModal.querySelectorAll('[data-pwa-tab]');
      pwaTabs.forEach(btn => {
        btn.addEventListener('click', () => {
          playSfx('click');
          switchPwaGuideTab(btn.dataset.pwaTab);
        });
      });
      els.pwaGuideModal.addEventListener('click', (e) => {
        if (e.target === els.pwaGuideModal) closeModal(els.pwaGuideModal);
      });
    }

    if (els.menuInstallPwaBtn) {
      els.menuInstallPwaBtn.addEventListener('click', () => {
        closeOverflowMenu();
        triggerPwaInstallFlow();
      });
    }

    if (els.menuTestPwaToastBtn) {
      els.menuTestPwaToastBtn.addEventListener('click', () => {
        closeOverflowMenu();
        playSfx('click');
        showPwaUpdateToast();
      });
    }

    // Auto-show PWA banner after 1.2s if not standalone and not dismissed
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      setTimeout(() => {
        const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
        let dismissed = false;
        try {
          dismissed = window.localStorage && window.localStorage.getItem(PWA_DISMISSED_KEY) === 'true';
        } catch (_) {}
        if (!isStandalone && !dismissed && els.pwaBanner) {
          els.pwaBanner.style.display = 'flex';
        }
      }, 1200);
    }

    // PWA Service Worker Registration & Update Notification
    let swRegistration = null;
    function showPwaUpdateToast() {
      if (els.pwaUpdateToast) {
        els.pwaUpdateToast.style.display = 'flex';
      }
    }

    if (
      typeof window !== 'undefined'
      && typeof window.addEventListener === 'function'
      && typeof navigator !== 'undefined'
      && 'serviceWorker' in navigator
      && window.location
      && window.location.protocol
      && window.location.protocol.startsWith('http')
    ) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          swRegistration = reg;
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showPwaUpdateToast();
                }
              });
            }
          });
        }).catch((err) => {
          console.warn('SW registration skipped or failed:', err);
        });
      });
    }

    if (els.pwaReloadBtn) {
      els.pwaReloadBtn.addEventListener('click', () => {
        playSfx('click');
        if (swRegistration && swRegistration.waiting) {
          swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
      });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', renderWinLineOverlay);
    }
  }

  syncSoundToggleUI();
  syncMenuUI();
  bindEvents();
  switchView('home');
})();
