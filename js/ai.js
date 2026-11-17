/**
 * Connect-Four AI Engine — TIM 12 UTS PjBL Kecerdasan Buatan
 * Sinkron 1:1 dengan implementasi Python di Praktikum_AI_UTS_TIM12.ipynb.
 *
 * Fitur:
 * - Adversarial Search: Depth-Limited Minimax & Alpha-Beta Pruning
 * - Dukungan Mode 2-Player (Minimax Klasik) & 4-Player (Paranoid Minimax + Alpha-Beta)
 * - Heuristic Board Evaluation Function (4-cell window + kontrol kolom tengah)
 * - Dukungan variasi papan & ukuran dinamis: 6x7, 7x8, 7x9 + Klasik, Obstacle
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ConnectFourAI = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ROWS = 6;
  const COLS = 7;
  const WINDOW_LENGTH = 4;

  const BLOCKED = -1;
  const EMPTY = 0;
  const HUMAN = 1; // Pemain 1 (Coral)
  const AI = 2;    // Pemain 2 (Kuning)
  const P3 = 3;    // Pemain 3 (Hijau)
  const P4 = 4;    // Pemain 4 (Ungu)

  const WIN_SCORE = 100000;
  const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];

  const BOARD_SIZES = {
    '6x7': { rows: 6, cols: 7, label: '6×7' },
    '7x8': { rows: 7, cols: 8, label: '7×8' },
    '7x9': { rows: 7, cols: 9, label: '7×9' },
    '8x10': { rows: 8, cols: 10, label: '8×10' },
  };

  const EVAL_WEIGHTS = {
    WIN: 100000,
    AI_THREE: 12,
    AI_TWO: 3,
    OPP_THREE: -80,
    OPP_TWO: -2,
    CENTER_PER_DISC: 4,
  };

  const DIFFICULTY_PRESETS = {
    Easy: { maxDepth: 0, usePruning: false, label: 'Easy (Random Move)' },
    Medium: { maxDepth: 3, usePruning: false, label: 'Medium (Depth-Limited Minimax, depth=3)' },
    Hard: { maxDepth: 5, usePruning: true, label: 'Hard (Depth-Limited + Alpha-Beta, depth=5)' },
  };

  /**
   * Kembalikan urutan kolom tengah-ke-pinggir untuk jumlah kolom berapa pun.
   */
  function getColumnOrder(cols = COLS) {
    const order = [];
    if (cols % 2 === 1) {
      const mid = Math.floor(cols / 2);
      order.push(mid);
      for (let d = 1; d <= mid; d++) {
        order.push(mid - d);
        order.push(mid + d);
      }
    } else {
      const left = cols / 2 - 1;
      const right = cols / 2;
      for (let d = 0; d < cols / 2; d++) {
        order.push(left - d);
        order.push(right + d);
      }
    }
    return order;
  }

  /**
   * Kembalikan pemain berikutnya secara siklik (1..playerCount).
   */
  function getNextPlayer(piece, playerCount = 2) {
    const total = playerCount >= 4 ? 4 : 2;
    return piece >= total ? 1 : piece + 1;
  }

  /**
   * Buat papan kosong berukuran rows x cols (baris 0 = paling atas).
   */
  function createBoard(rows = ROWS, cols = COLS) {
    const board = [];
    for (let r = 0; r < rows; r++) {
      board.push(new Array(cols).fill(EMPTY));
    }
    return board;
  }

  /**
   * Buat konfigurasi awal papan sesuai mode ('classic', 'obstacle') dan ukuran rows x cols.
   * Mengembalikan { board, obstacles }.
   */
  function createSpecialSetup(boardMode = 'classic', rows = ROWS, cols = COLS) {
    const board = createBoard(rows, cols);
    const obstacles = [];

    if (boardMode === 'obstacle') {
      const centerSet = new Set(
        cols % 2 === 1 ? [Math.floor(cols / 2)] : [cols / 2 - 1, cols / 2]
      );
      const candidateCols = [];
      for (let c = 0; c < cols; c++) {
        if (!centerSet.has(c)) candidateCols.push(c);
      }
      for (let i = candidateCols.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = candidateCols[i];
        candidateCols[i] = candidateCols[j];
        candidateCols[j] = tmp;
      }

      const spots = [
        [rows - 1, candidateCols[0]],
        [rows - 1, candidateCols[1]],
        [rows - 2, candidateCols[1]],
        [rows - 1, candidateCols[2]],
      ];
      if (cols >= 8 && candidateCols.length >= 4) {
        spots.push([rows - 1, candidateCols[3]]);
      }
      if (cols >= 10 && candidateCols.length >= 4) {
        spots.push([rows - 2, candidateCols[3]]);
      }

      spots.forEach(([r, c]) => {
        board[r][c] = BLOCKED;
        obstacles.push([r, c]);
      });
    }

    return { board, obstacles };
  }

  /**
   * Salin papan 2D secara mendalam.
   */
  function cloneBoard(board) {
    return board.map((row) => row.slice());
  }

  /**
   * Cek apakah kolom masih memiliki ruang kosong di paling atas.
   */
  function isValidLocation(board, col) {
    const cols = board[0].length;
    return col >= 0 && col < cols && board[0][col] === EMPTY;
  }

  /**
   * Kembalikan daftar kolom valid sesuai urutan tengah-ke-pinggir.
   */
  function getValidLocations(board) {
    const order = getColumnOrder(board[0].length);
    const valid = [];
    for (let i = 0; i < order.length; i++) {
      const col = order[i];
      if (isValidLocation(board, col)) {
        valid.push(col);
      }
    }
    return valid;
  }

  /**
   * Cari baris terbawah yang masih kosong pada kolom tertentu.
   */
  function getNextOpenRow(board, col) {
    for (let r = board.length - 1; r >= 0; r--) {
      if (board[r][col] === EMPTY) {
        return r;
      }
    }
    return -1;
  }

  /**
   * Jatuhkan bidak ke koordinat (row, col).
   */
  function dropPiece(board, row, col, piece) {
    board[row][col] = piece;
  }

  /**
   * Cek pemenang (mendukung pemain 1..4) atau seri beserta koordinat 4 bidak terhubung.
   * Mengembalikan { winner: 1 | 2 | 3 | 4 | 'DRAW' | null, cells: [[r, c], ...] }.
   */
  function getWinnerInfo(board) {
    const rows = board.length;
    const cols = board[0].length;
    const isPlayer = (p) => p >= 1 && p <= 4;

    // Cek horizontal
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols - WINDOW_LENGTH; c++) {
        const p = board[r][c];
        if (isPlayer(p) && p === board[r][c + 1] && p === board[r][c + 2] && p === board[r][c + 3]) {
          return { winner: p, cells: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]] };
        }
      }
    }

    // Cek vertikal
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r <= rows - WINDOW_LENGTH; r++) {
        const p = board[r][c];
        if (isPlayer(p) && p === board[r + 1][c] && p === board[r + 2][c] && p === board[r + 3][c]) {
          return { winner: p, cells: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]] };
        }
      }
    }

    // Cek diagonal turun ke kanan (\)
    for (let r = 0; r <= rows - WINDOW_LENGTH; r++) {
      for (let c = 0; c <= cols - WINDOW_LENGTH; c++) {
        const p = board[r][c];
        if (isPlayer(p) && p === board[r + 1][c + 1] && p === board[r + 2][c + 2] && p === board[r + 3][c + 3]) {
          return { winner: p, cells: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]] };
        }
      }
    }

    // Cek diagonal naik ke kanan (/)
    for (let r = WINDOW_LENGTH - 1; r < rows; r++) {
      for (let c = 0; c <= cols - WINDOW_LENGTH; c++) {
        const p = board[r][c];
        if (isPlayer(p) && p === board[r - 1][c + 1] && p === board[r - 2][c + 2] && p === board[r - 3][c + 3]) {
          return { winner: p, cells: [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]] };
        }
      }
    }

    // Cek seri jika semua kolom teratas penuh
    if (getValidLocations(board).length === 0) {
      return { winner: 'DRAW', cells: [] };
    }

    return { winner: null, cells: [] };
  }

  /**
   * Wrapper sederhana mengembalikan 1..4, 'DRAW', atau null.
   */
  function checkWinner(board) {
    return getWinnerInfo(board).winner;
  }

  /**
   * Analisis satu jendela 4-petak untuk 2-Player maupun 4-Player.
   * Jendela hanya bernilai jika hanya diisi 1 pihak (+ petak kosong).
   */
  function classifyWindow(windowCells, aiPiece) {
    let aiCount = 0;
    let emptyCount = 0;
    let soleOpp = 0;
    let soleOppCount = 0;

    for (let i = 0; i < windowCells.length; i++) {
      const cell = windowCells[i];
      if (cell === BLOCKED) return { kind: 'blocked', score: 0 };
      if (cell === EMPTY) {
        emptyCount++;
      } else if (cell === aiPiece) {
        aiCount++;
      } else {
        if (soleOpp === 0) {
          soleOpp = cell;
          soleOppCount = 1;
        } else if (soleOpp === cell) {
          soleOppCount++;
        } else {
          // 2 lawan berbeda bentrok dalam satu jendela -> tidak bisa menjadi 4-in-a-row
          return { kind: 'mixed', score: 0 };
        }
      }
    }

    if (aiCount > 0 && soleOppCount > 0) {
      return { kind: 'mixed', score: 0 };
    }
    if (aiCount === 4) return { kind: 'ai_win', score: EVAL_WEIGHTS.WIN };
    if (soleOppCount === 4) return { kind: 'opp_win', score: -EVAL_WEIGHTS.WIN };
    if (aiCount === 3 && emptyCount === 1) return { kind: 'ai3', score: EVAL_WEIGHTS.AI_THREE };
    if (aiCount === 2 && emptyCount === 2) return { kind: 'ai2', score: EVAL_WEIGHTS.AI_TWO };
    if (soleOppCount === 3 && emptyCount === 1) return { kind: 'opp3', score: EVAL_WEIGHTS.OPP_THREE };
    if (soleOppCount === 2 && emptyCount === 2) return { kind: 'opp2', score: EVAL_WEIGHTS.OPP_TWO };
    return { kind: 'neutral', score: 0 };
  }

  /**
   * Hitung skor satu jendela berisi 4 petak dari sudut pandang aiPiece.
   */
  function evaluateWindow(windowCells, aiPiece) {
    return classifyWindow(windowCells, aiPiece).score;
  }

  /**
   * Analisis papan menyeluruh untuk ukuran rows x cols dan 2 atau 4 pemain.
   */
  function analyzeBoard(board, aiPiece = AI, playerCount = 2) {
    const rows = board.length;
    const cols = board[0].length;
    const totalPlayers = playerCount >= 4 ? 4 : 2;

    const centerCols = cols % 2 === 1 ? [Math.floor(cols / 2)] : [cols / 2 - 1, cols / 2];
    const centerWeight = cols % 2 === 1 ? EVAL_WEIGHTS.CENTER_PER_DISC : Math.floor(EVAL_WEIGHTS.CENTER_PER_DISC / 2);

    let centerAi = 0;
    const oppCenterCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let i = 0; i < centerCols.length; i++) {
      const cc = centerCols[i];
      for (let r = 0; r < rows; r++) {
        const cell = board[r][cc];
        if (cell === aiPiece) {
          centerAi++;
        } else if (cell >= 1 && cell <= totalPlayers) {
          oppCenterCounts[cell] += 1;
        }
      }
    }

    let centerOpp = 0;
    for (let p = 1; p <= totalPlayers; p++) {
      if (p !== aiPiece && oppCenterCounts[p] > centerOpp) {
        centerOpp = oppCenterCounts[p];
      }
    }

    let aiThree = 0;
    let aiTwo = 0;
    let oppThree = 0;
    let oppTwo = 0;
    let windowScore = 0;

    function processWindow(w) {
      const res = classifyWindow(w, aiPiece);
      if (res.kind === 'ai3') aiThree++;
      else if (res.kind === 'ai2') aiTwo++;
      else if (res.kind === 'opp3') oppThree++;
      else if (res.kind === 'opp2') oppTwo++;
      windowScore += res.score;
    }

    // Horizontal
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols - WINDOW_LENGTH; c++) {
        processWindow([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]]);
      }
    }

    // Vertikal
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r <= rows - WINDOW_LENGTH; r++) {
        processWindow([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]]);
      }
    }

    // Diagonal turun (\)
    for (let r = 0; r <= rows - WINDOW_LENGTH; r++) {
      for (let c = 0; c <= cols - WINDOW_LENGTH; c++) {
        processWindow([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]]);
      }
    }

    // Diagonal naik (/)
    for (let r = WINDOW_LENGTH - 1; r < rows; r++) {
      for (let c = 0; c <= cols - WINDOW_LENGTH; c++) {
        processWindow([board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]]);
      }
    }

    const centerScore = (centerAi - centerOpp) * centerWeight;
    return {
      totalScore: windowScore + centerScore,
      centerAi,
      centerOpp,
      centerScore,
      aiThree,
      aiTwo,
      oppThree,
      oppTwo,
      windowScore,
    };
  }

  /**
   * Fungsi Evaluasi Papan (Evaluation Function) untuk non-terminal state.
   */
  function evaluateBoard(board, aiPiece = AI, playerCount = 2) {
    return analyzeBoard(board, aiPiece, playerCount).totalScore;
  }

  /**
   * Depth-Limited Minimax Murni (tanpa Alpha-Beta Pruning).
   * Pada 2P: bergantian MAX (aiPiece) vs MIN (lawan).
   * Pada 4P (Paranoid Minimax): giliran berotasi 1->2->3->4 dengan semua non-aiPiece berperan MIN.
   */
  function minimax(board, depth, maxDepth, turnOrMax, aiPiece, stats, playerCount = 2) {
    stats.nodes += 1;
    const totalPlayers = playerCount >= 4 ? 4 : 2;
    const turnPiece =
      typeof turnOrMax === 'boolean'
        ? (turnOrMax ? aiPiece : getNextPlayer(aiPiece, totalPlayers))
        : turnOrMax;

    const winner = checkWinner(board);
    if (winner === aiPiece) return WIN_SCORE - depth;
    if (winner === 'DRAW') return 0;
    if (winner !== null) return depth - WIN_SCORE;

    if (depth >= maxDepth) {
      return evaluateBoard(board, aiPiece, totalPlayers);
    }

    const validCols = getValidLocations(board);
    const nextPiece = getNextPlayer(turnPiece, totalPlayers);
    const isMaximizing = turnPiece === aiPiece;

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < validCols.length; i++) {
        const col = validCols[i];
        const row = getNextOpenRow(board, col);
        board[row][col] = turnPiece;
        const score = minimax(board, depth + 1, maxDepth, nextPiece, aiPiece, stats, totalPlayers);
        board[row][col] = EMPTY;
        if (score > bestScore) bestScore = score;
      }
      return bestScore;
    }

    let bestScore = Infinity;
    for (let i = 0; i < validCols.length; i++) {
      const col = validCols[i];
      const row = getNextOpenRow(board, col);
      board[row][col] = turnPiece;
      const score = minimax(board, depth + 1, maxDepth, nextPiece, aiPiece, stats, totalPlayers);
      board[row][col] = EMPTY;
      if (score < bestScore) bestScore = score;
    }
    return bestScore;
  }

  /**
   * Depth-Limited Minimax dengan optimasi Alpha-Beta Pruning (2P & 4P Paranoid).
   */
  function minimaxAlphaBeta(board, depth, maxDepth, alpha, beta, turnOrMax, aiPiece, stats, playerCount = 2) {
    stats.nodes += 1;
    const totalPlayers = playerCount >= 4 ? 4 : 2;
    const turnPiece =
      typeof turnOrMax === 'boolean'
        ? (turnOrMax ? aiPiece : getNextPlayer(aiPiece, totalPlayers))
        : turnOrMax;

    const winner = checkWinner(board);
    if (winner === aiPiece) return WIN_SCORE - depth;
    if (winner === 'DRAW') return 0;
    if (winner !== null) return depth - WIN_SCORE;

    if (depth >= maxDepth) {
      return evaluateBoard(board, aiPiece, totalPlayers);
    }

    const validCols = getValidLocations(board);
    const nextPiece = getNextPlayer(turnPiece, totalPlayers);
    const isMaximizing = turnPiece === aiPiece;

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let i = 0; i < validCols.length; i++) {
        const col = validCols[i];
        const row = getNextOpenRow(board, col);
        board[row][col] = turnPiece;
        const evalScore = minimaxAlphaBeta(board, depth + 1, maxDepth, alpha, beta, nextPiece, aiPiece, stats, totalPlayers);
        board[row][col] = EMPTY;
        if (evalScore > maxEval) maxEval = evalScore;
        if (maxEval > alpha) alpha = maxEval;
        if (alpha >= beta) break;
      }
      return maxEval;
    }

    let minEval = Infinity;
    for (let i = 0; i < validCols.length; i++) {
      const col = validCols[i];
      const row = getNextOpenRow(board, col);
      board[row][col] = turnPiece;
      const evalScore = minimaxAlphaBeta(board, depth + 1, maxDepth, alpha, beta, nextPiece, aiPiece, stats, totalPlayers);
      board[row][col] = EMPTY;
      if (evalScore < minEval) minEval = evalScore;
      if (minEval < beta) beta = minEval;
      if (alpha >= beta) break;
    }
    return minEval;
  }

  /**
   * Cari langkah terbaik beserta skor evaluasi tiap kolom dan metrik pencarian.
   */
  function findBestMove(board, options = {}) {
    const maxDepth = options.maxDepth !== undefined ? options.maxDepth : 4;
    const aiPiece = options.aiPiece !== undefined ? options.aiPiece : AI;
    const usePruning = options.usePruning !== undefined ? options.usePruning : true;
    const playerCount = options.playerCount !== undefined ? options.playerCount : 2;

    const workingBoard = cloneBoard(board);
    const cols = workingBoard[0].length;
    const validCols = getValidLocations(workingBoard);
    const columnScores = {};
    for (let c = 0; c < cols; c++) {
      columnScores[c] = null;
    }

    if (validCols.length === 0) {
      return {
        bestCol: -1,
        bestScore: 0,
        columnScores,
        nodes: 0,
        elapsedMs: 0,
        maxDepth,
        usePruning,
      };
    }

    const stats = { nodes: 0 };
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

    let bestScore = -Infinity;
    let bestCol = validCols[0];
    let alpha = -Infinity;
    const beta = Infinity;
    const nextTurn = getNextPlayer(aiPiece, playerCount);

    for (let i = 0; i < validCols.length; i++) {
      const col = validCols[i];
      const row = getNextOpenRow(workingBoard, col);
      workingBoard[row][col] = aiPiece;

      const score = usePruning
        ? minimaxAlphaBeta(workingBoard, 1, maxDepth, alpha, beta, nextTurn, aiPiece, stats, playerCount)
        : minimax(workingBoard, 1, maxDepth, nextTurn, aiPiece, stats, playerCount);

      workingBoard[row][col] = EMPTY;
      columnScores[col] = score;

      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
      if (usePruning && bestScore > alpha) {
        alpha = bestScore;
      }
    }

    const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return {
      bestCol,
      bestScore,
      columnScores,
      nodes: stats.nodes,
      elapsedMs: Number((t1 - t0).toFixed(2)),
      maxDepth,
      usePruning,
    };
  }

  /**
   * Pilih langkah Bot AI berdasarkan tingkat kesulitan ('Easy', 'Medium', 'Hard')
   * atau konfigurasi depth/pruning kustom.
   */
  function chooseMove(board, options = {}) {
    const difficulty = options.difficulty || 'Hard';
    const aiPiece = options.aiPiece !== undefined ? options.aiPiece : AI;
    const playerCount = options.playerCount !== undefined ? options.playerCount : 2;
    const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.Hard;
    const cols = board[0].length;

    if (difficulty === 'Easy' && options.customDepth === undefined) {
      const validCols = getValidLocations(board);
      const columnScores = {};
      for (let c = 0; c < cols; c++) {
        columnScores[c] = null;
      }
      if (validCols.length === 0) {
        return { bestCol: -1, bestScore: 0, columnScores, nodes: 0, elapsedMs: 0, maxDepth: 0, usePruning: false, isRandom: true };
      }
      const workingBoard = cloneBoard(board);
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      for (let i = 0; i < validCols.length; i++) {
        const c = validCols[i];
        const r = getNextOpenRow(workingBoard, c);
        workingBoard[r][c] = aiPiece;
        columnScores[c] = evaluateBoard(workingBoard, aiPiece, playerCount);
        workingBoard[r][c] = EMPTY;
      }
      const randomCol = validCols[Math.floor(Math.random() * validCols.length)];
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      return {
        bestCol: randomCol,
        bestScore: columnScores[randomCol],
        columnScores,
        nodes: validCols.length,
        elapsedMs: Number((t1 - t0).toFixed(2)),
        maxDepth: 0,
        usePruning: false,
        isRandom: true,
      };
    }

    const defaultDepth = (playerCount >= 4 || cols >= 10) && difficulty === 'Hard' ? 4 : preset.maxDepth;
    const maxDepth = options.customDepth !== undefined ? options.customDepth : defaultDepth;
    const usePruning = options.usePruning !== undefined ? options.usePruning : preset.usePruning;

    const result = findBestMove(board, { maxDepth, aiPiece, usePruning, playerCount });
    result.isRandom = false;
    return result;
  }

  /**
   * Jalankan perbandingan langsung Minimax Murni vs Alpha-Beta Pruning pada papan saat ini.
   */
  function compareAlgorithms(board, maxDepth = 4, aiPiece = AI, playerCount = 2) {
    const pureMinimax = findBestMove(board, { maxDepth, aiPiece, usePruning: false, playerCount });
    const alphaBeta = findBestMove(board, { maxDepth, aiPiece, usePruning: true, playerCount });

    const reductionPct =
      pureMinimax.nodes > 0
        ? Number((((pureMinimax.nodes - alphaBeta.nodes) / pureMinimax.nodes) * 100).toFixed(1))
        : 0;

    return {
      maxDepth,
      pureMinimax,
      alphaBeta,
      reductionPct,
      sameDecision: pureMinimax.bestCol === alphaBeta.bestCol,
    };
  }

  return {
    ROWS,
    COLS,
    WINDOW_LENGTH,
    BLOCKED,
    EMPTY,
    HUMAN,
    AI,
    P3,
    P4,
    WIN_SCORE,
    COLUMN_ORDER,
    BOARD_SIZES,
    EVAL_WEIGHTS,
    DIFFICULTY_PRESETS,
    getColumnOrder,
    getNextPlayer,
    createBoard,
    createSpecialSetup,
    cloneBoard,
    isValidLocation,
    getValidLocations,
    getNextOpenRow,
    dropPiece,
    getWinnerInfo,
    checkWinner,
    evaluateWindow,
    analyzeBoard,
    evaluateBoard,
    minimax,
    minimaxAlphaBeta,
    findBestMove,
    chooseMove,
    compareAlgorithms,
  };
});
