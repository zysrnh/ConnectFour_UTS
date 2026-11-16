/**
 * Connect-Four AI Engine — TIM 12 UTS PjBL Kecerdasan Buatan
 * Sinkron 1:1 dengan implementasi Python di Praktikum_AI_UTS_TIM12.ipynb.
 *
 * Metode:
 * - Adversarial Search: Depth-Limited Minimax & Alpha-Beta Pruning
 * - Heuristic Board Evaluation Function (4-cell window + kontrol kolom tengah)
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

  const EMPTY = 0;
  const HUMAN = 1;
  const AI = 2;

  const WIN_SCORE = 100000;
  const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];

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
   * Buat papan kosong berukuran 6x7 (baris 0 = paling atas, baris 5 = paling bawah).
   */
  function createBoard() {
    const board = [];
    for (let r = 0; r < ROWS; r++) {
      board.push(new Array(COLS).fill(EMPTY));
    }
    return board;
  }

  /**
   * Salin papan 2D secara mendalam.
   */
  function cloneBoard(board) {
    return board.map((row) => row.slice());
  }

  /**
   * Cek apakah kolom masih memiliki ruang kosong.
   */
  function isValidLocation(board, col) {
    return col >= 0 && col < COLS && board[0][col] === EMPTY;
  }

  /**
   * Kembalikan daftar kolom valid sesuai prioritas tengah-ke-pinggir.
   */
  function getValidLocations(board) {
    const valid = [];
    for (let i = 0; i < COLUMN_ORDER.length; i++) {
      const col = COLUMN_ORDER[i];
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
    for (let r = ROWS - 1; r >= 0; r--) {
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
   * Cek pemenang atau seri beserta koordinat 4 bidak yang terhubung.
   * Mengembalikan { winner: 1 | 2 | 'DRAW' | null, cells: [[r, c], ...] }.
   */
  function getWinnerInfo(board) {
    // Cek horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - WINDOW_LENGTH; c++) {
        const p = board[r][c];
        if (p !== EMPTY && p === board[r][c + 1] && p === board[r][c + 2] && p === board[r][c + 3]) {
          return { winner: p, cells: [[r, c], [r, c + 1], [r, c + 2], [r, c + 3]] };
        }
      }
    }

    // Cek vertikal
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - WINDOW_LENGTH; r++) {
        const p = board[r][c];
        if (p !== EMPTY && p === board[r + 1][c] && p === board[r + 2][c] && p === board[r + 3][c]) {
          return { winner: p, cells: [[r, c], [r + 1, c], [r + 2, c], [r + 3, c]] };
        }
      }
    }

    // Cek diagonal turun ke kanan (\)
    for (let r = 0; r <= ROWS - WINDOW_LENGTH; r++) {
      for (let c = 0; c <= COLS - WINDOW_LENGTH; c++) {
        const p = board[r][c];
        if (p !== EMPTY && p === board[r + 1][c + 1] && p === board[r + 2][c + 2] && p === board[r + 3][c + 3]) {
          return { winner: p, cells: [[r, c], [r + 1, c + 1], [r + 2, c + 2], [r + 3, c + 3]] };
        }
      }
    }

    // Cek diagonal naik ke kanan (/)
    for (let r = WINDOW_LENGTH - 1; r < ROWS; r++) {
      for (let c = 0; c <= COLS - WINDOW_LENGTH; c++) {
        const p = board[r][c];
        if (p !== EMPTY && p === board[r - 1][c + 1] && p === board[r - 2][c + 2] && p === board[r - 3][c + 3]) {
          return { winner: p, cells: [[r, c], [r - 1, c + 1], [r - 2, c + 2], [r - 3, c + 3]] };
        }
      }
    }

    // Cek seri jika baris paling atas sudah penuh
    let full = true;
    for (let c = 0; c < COLS; c++) {
      if (board[0][c] === EMPTY) {
        full = false;
        break;
      }
    }
    if (full) {
      return { winner: 'DRAW', cells: [] };
    }

    return { winner: null, cells: [] };
  }

  /**
   * Wrapper sederhana mengembalikan 1, 2, 'DRAW', atau null.
   */
  function checkWinner(board) {
    return getWinnerInfo(board).winner;
  }

  /**
   * Hitung skor satu jendela berisi 4 petak dari sudut pandang aiPiece.
   */
  function evaluateWindow(windowCells, aiPiece) {
    const oppPiece = aiPiece === HUMAN ? AI : HUMAN;
    let aiCount = 0;
    let oppCount = 0;
    let emptyCount = 0;

    for (let i = 0; i < windowCells.length; i++) {
      if (windowCells[i] === aiPiece) {
        aiCount++;
      } else if (windowCells[i] === oppPiece) {
        oppCount++;
      } else {
        emptyCount++;
      }
    }

    if (aiCount === 4) return EVAL_WEIGHTS.WIN;
    if (oppCount === 4) return -EVAL_WEIGHTS.WIN;
    if (aiCount === 3 && emptyCount === 1) return EVAL_WEIGHTS.AI_THREE;
    if (aiCount === 2 && emptyCount === 2) return EVAL_WEIGHTS.AI_TWO;
    if (oppCount === 3 && emptyCount === 1) return EVAL_WEIGHTS.OPP_THREE;
    if (oppCount === 2 && emptyCount === 2) return EVAL_WEIGHTS.OPP_TWO;
    return 0;
  }

  /**
   * Analisis papan menyeluruh: menghitung total skor evaluasi sekaligus rincian fitur heuristik.
   */
  function analyzeBoard(board, aiPiece = AI) {
    const oppPiece = aiPiece === HUMAN ? AI : HUMAN;
    const centerCol = Math.floor(COLS / 2);

    let centerAi = 0;
    let centerOpp = 0;
    for (let r = 0; r < ROWS; r++) {
      if (board[r][centerCol] === aiPiece) centerAi++;
      else if (board[r][centerCol] === oppPiece) centerOpp++;
    }

    let aiThree = 0;
    let aiTwo = 0;
    let oppThree = 0;
    let oppTwo = 0;
    let windowScore = 0;

    function processWindow(w) {
      let aiCount = 0;
      let oppCount = 0;
      let emptyCount = 0;
      for (let i = 0; i < 4; i++) {
        if (w[i] === aiPiece) aiCount++;
        else if (w[i] === oppPiece) oppCount++;
        else emptyCount++;
      }
      if (aiCount === 3 && emptyCount === 1) aiThree++;
      else if (aiCount === 2 && emptyCount === 2) aiTwo++;
      else if (oppCount === 3 && emptyCount === 1) oppThree++;
      else if (oppCount === 2 && emptyCount === 2) oppTwo++;
      windowScore += evaluateWindow(w, aiPiece);
    }

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - WINDOW_LENGTH; c++) {
        processWindow([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]]);
      }
    }

    // Vertikal
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - WINDOW_LENGTH; r++) {
        processWindow([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]]);
      }
    }

    // Diagonal turun (\)
    for (let r = 0; r <= ROWS - WINDOW_LENGTH; r++) {
      for (let c = 0; c <= COLS - WINDOW_LENGTH; c++) {
        processWindow([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]]);
      }
    }

    // Diagonal naik (/)
    for (let r = WINDOW_LENGTH - 1; r < ROWS; r++) {
      for (let c = 0; c <= COLS - WINDOW_LENGTH; c++) {
        processWindow([board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]]);
      }
    }

    const centerScore = (centerAi - centerOpp) * EVAL_WEIGHTS.CENTER_PER_DISC;
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
  function evaluateBoard(board, aiPiece = AI) {
    return analyzeBoard(board, aiPiece).totalScore;
  }

  /**
   * Depth-Limited Minimax Murni (tanpa Alpha-Beta Pruning).
   */
  function minimax(board, depth, maxDepth, isMaximizing, aiPiece, stats) {
    stats.nodes += 1;
    const oppPiece = aiPiece === HUMAN ? AI : HUMAN;

    const winner = checkWinner(board);
    if (winner === aiPiece) return WIN_SCORE - depth;
    if (winner === oppPiece) return depth - WIN_SCORE;
    if (winner === 'DRAW') return 0;

    if (depth >= maxDepth) {
      return evaluateBoard(board, aiPiece);
    }

    const validCols = getValidLocations(board);

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < validCols.length; i++) {
        const col = validCols[i];
        const row = getNextOpenRow(board, col);
        board[row][col] = aiPiece;
        const score = minimax(board, depth + 1, maxDepth, false, aiPiece, stats);
        board[row][col] = EMPTY;
        if (score > bestScore) {
          bestScore = score;
        }
      }
      return bestScore;
    }

    let bestScore = Infinity;
    for (let i = 0; i < validCols.length; i++) {
      const col = validCols[i];
      const row = getNextOpenRow(board, col);
      board[row][col] = oppPiece;
      const score = minimax(board, depth + 1, maxDepth, true, aiPiece, stats);
      board[row][col] = EMPTY;
      if (score < bestScore) {
        bestScore = score;
      }
    }
    return bestScore;
  }

  /**
   * Depth-Limited Minimax dengan optimasi Alpha-Beta Pruning.
   */
  function minimaxAlphaBeta(board, depth, maxDepth, alpha, beta, isMaximizing, aiPiece, stats) {
    stats.nodes += 1;
    const oppPiece = aiPiece === HUMAN ? AI : HUMAN;

    const winner = checkWinner(board);
    if (winner === aiPiece) return WIN_SCORE - depth;
    if (winner === oppPiece) return depth - WIN_SCORE;
    if (winner === 'DRAW') return 0;

    if (depth >= maxDepth) {
      return evaluateBoard(board, aiPiece);
    }

    const validCols = getValidLocations(board);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (let i = 0; i < validCols.length; i++) {
        const col = validCols[i];
        const row = getNextOpenRow(board, col);
        board[row][col] = aiPiece;
        const evalScore = minimaxAlphaBeta(board, depth + 1, maxDepth, alpha, beta, false, aiPiece, stats);
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
      board[row][col] = oppPiece;
      const evalScore = minimaxAlphaBeta(board, depth + 1, maxDepth, alpha, beta, true, aiPiece, stats);
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

    const workingBoard = cloneBoard(board);
    const validCols = getValidLocations(workingBoard);
    const columnScores = {};
    for (let c = 0; c < COLS; c++) {
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

    for (let i = 0; i < validCols.length; i++) {
      const col = validCols[i];
      const row = getNextOpenRow(workingBoard, col);
      workingBoard[row][col] = aiPiece;

      const score = usePruning
        ? minimaxAlphaBeta(workingBoard, 1, maxDepth, alpha, beta, false, aiPiece, stats)
        : minimax(workingBoard, 1, maxDepth, false, aiPiece, stats);

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
    const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.Hard;

    if (difficulty === 'Easy' && options.customDepth === undefined) {
      const validCols = getValidLocations(board);
      const columnScores = {};
      for (let c = 0; c < COLS; c++) {
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
        columnScores[c] = evaluateBoard(workingBoard, aiPiece);
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

    const maxDepth = options.customDepth !== undefined ? options.customDepth : preset.maxDepth;
    const usePruning = options.usePruning !== undefined ? options.usePruning : preset.usePruning;

    const result = findBestMove(board, { maxDepth, aiPiece, usePruning });
    result.isRandom = false;
    return result;
  }

  /**
   * Jalankan perbandingan langsung Minimax Murni vs Alpha-Beta Pruning pada papan saat ini.
   */
  function compareAlgorithms(board, maxDepth = 4, aiPiece = AI) {
    const pureMinimax = findBestMove(board, { maxDepth, aiPiece, usePruning: false });
    const alphaBeta = findBestMove(board, { maxDepth, aiPiece, usePruning: true });

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
    EMPTY,
    HUMAN,
    AI,
    WIN_SCORE,
    COLUMN_ORDER,
    EVAL_WEIGHTS,
    DIFFICULTY_PRESETS,
    createBoard,
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
