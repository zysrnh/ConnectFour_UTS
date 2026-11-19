"""
Connect-Four AI — Google Colab Interactive UI Bridge
Modul ini memuat antarmuka Retro Web UI dan menghubungkannya dengan kernel Python Google Colab.
Dibuat rapi dan terpisah agar file notebook (.ipynb) tetap bersih, ringkas, dan tidak dipenuhi raw HTML string.
"""

import json
import os
import re
from pathlib import Path


def build_retro_ui_html() -> str:
    """Membangun string HTML lengkap dari aset web (lokal repo atau online GitHub raw)."""
    repo_dir = Path(__file__).resolve().parent
    index_file = repo_dir / "index.html"
    style_file = repo_dir / "style.css"
    ai_file = repo_dir / "js" / "ai.js"
    app_file = repo_dir / "js" / "app.js"

    if index_file.exists() and style_file.exists() and ai_file.exists() and app_file.exists():
        raw_html = index_file.read_text(encoding="utf-8")
        css_text = style_file.read_text(encoding="utf-8")
        ai_js = ai_file.read_text(encoding="utf-8")
        app_js = app_file.read_text(encoding="utf-8")
    else:
        # Fallback online jika notebook dijalankan mandiri di cloud Google Colab tanpa clone repo
        import urllib.request
        base_url = "https://raw.githubusercontent.com/zysrnh/ConnectFour_UTS/main"
        raw_html = urllib.request.urlopen(f"{base_url}/index.html", timeout=10).read().decode("utf-8")
        css_text = urllib.request.urlopen(f"{base_url}/style.css", timeout=10).read().decode("utf-8")
        ai_js = urllib.request.urlopen(f"{base_url}/js/ai.js", timeout=10).read().decode("utf-8")
        app_js = urllib.request.urlopen(f"{base_url}/js/app.js", timeout=10).read().decode("utf-8")

    # Ambil fragmen antarmuka utama (Stage game dan modal)
    match = re.search(r"(<!-- VIEW 1:.*?)(?=<script\s+src=)", raw_html, flags=re.DOTALL)
    if not match:
        raise ValueError("Gagal mengekstrak fragmen body game dari index.html")
    body_fragment = match.group(1).strip()

    colab_css_extra = """
body {
  min-height: 760px !important;
  padding-bottom: 24px !important;
}
.modal-backdrop {
  align-items: flex-start;
  padding-top: 32px;
}
"""

    colab_bridge_js = """
(function () {
  if (typeof google !== 'undefined' && google.colab && google.colab.kernel) {
    window.ConnectFourBridge = {
      label: 'Engine: Python Kernel Aktif (Google Colab • google.colab.output)',
      async chooseMove(board, options) {
        try {
          const res = await google.colab.kernel.invokeFunction(
            'connect4.bot_move',
            [
              JSON.stringify(board),
              options.difficulty || 'Hard',
              options.aiPiece !== undefined ? options.aiPiece : 2,
              options.usePruning !== undefined ? options.usePruning : null,
              options.customDepth !== undefined ? options.customDepth : null,
              options.playerCount !== undefined ? options.playerCount : 2,
            ],
            {}
          );
          const data = res && res.data && res.data['application/json'];
          if (data) return data;
        } catch (err) {
          console.warn('Colab Python bridge fallback ke JS:', err);
        }
        return window.ConnectFourAI.chooseMove(board, options);
      },
      async compareAlgorithms(board, depth, aiPiece, playerCount) {
        try {
          const res = await google.colab.kernel.invokeFunction(
            'connect4.compare',
            [JSON.stringify(board), depth, aiPiece, playerCount !== undefined ? playerCount : 2],
            {}
          );
          const data = res && res.data && res.data['application/json'];
          if (data) return data;
        } catch (err) {
          console.warn('Colab Python compare fallback ke JS:', err);
        }
        return window.ConnectFourAI.compareAlgorithms(board, depth, aiPiece, playerCount !== undefined ? playerCount : 2);
      },
    };
  }
})();
"""

    return (
        "<style>\n"
        + css_text
        + "\n"
        + colab_css_extra
        + "\n</style>\n"
        + body_fragment
        + "\n<script>\n"
        + ai_js
        + "\n"
        + colab_bridge_js
        + "\n"
        + app_js
        + "\n</script>"
    )


def launch_retro_colab_ui(choose_move_fn=None, compare_fn=None):
    """Merender UI Retro di Google Colab dan mendaftarkan callback kernel Python."""
    try:
        from IPython.display import HTML, display
    except ImportError:
        print("[Info] IPython/Colab display hook standby. Di Google Colab, sel ini akan langsung merender UI Retro 3-Layar interaktif.")
        return False

    is_colab = False
    try:
        from google.colab import output
        is_colab = True
    except ImportError:
        pass

    if is_colab and choose_move_fn is not None:
        def _bot_move_callback(board_json, difficulty="Hard", ai_piece=2, use_pruning=None, custom_depth=None, player_count=2):
            from IPython.display import JSON
            board = json.loads(board_json)
            depth_arg = int(custom_depth) if custom_depth is not None else None
            p_count = int(player_count) if player_count is not None else 2
            res = choose_move_fn(
                board,
                difficulty=difficulty,
                ai_piece=int(ai_piece),
                use_pruning=use_pruning,
                custom_depth=depth_arg,
                player_count=p_count,
            )
            return JSON({
                "bestCol": int(res["best_col"]),
                "bestScore": int(res["best_score"]),
                "columnScores": {str(k): (int(v) if v is not None else None) for k, v in res["column_scores"].items()},
                "nodes": int(res["nodes"]),
                "elapsedMs": float(res["elapsed_ms"]),
                "maxDepth": int(res["max_depth"]),
                "usePruning": bool(res["use_pruning"]),
                "isRandom": bool(res.get("is_random", False)),
            })

        def _compare_callback(board_json, max_depth=4, ai_piece=2, player_count=2):
            from IPython.display import JSON
            board = json.loads(board_json)
            p_count = int(player_count) if player_count is not None else 2
            comp = compare_fn(board, max_depth=int(max_depth), ai_piece=int(ai_piece), player_count=p_count)
            return JSON({
                "maxDepth": int(comp["max_depth"]),
                "reductionPct": float(comp["reduction_pct"]),
                "sameDecision": bool(comp["same_decision"]),
                "pureMinimax": {
                    "bestCol": int((comp.get("pure_minimax") or comp["pure"])["best_col"]),
                    "bestScore": int((comp.get("pure_minimax") or comp["pure"])["best_score"]),
                    "nodes": int((comp.get("pure_minimax") or comp["pure"])["nodes"]),
                    "elapsedMs": float((comp.get("pure_minimax") or comp["pure"])["elapsed_ms"]),
                },
                "alphaBeta": {
                    "bestCol": int((comp.get("alpha_beta") or comp["alphabeta"])["best_col"]),
                    "bestScore": int((comp.get("alpha_beta") or comp["alphabeta"])["best_score"]),
                    "nodes": int((comp.get("alpha_beta") or comp["alphabeta"])["nodes"]),
                    "elapsedMs": float((comp.get("alpha_beta") or comp["alphabeta"])["elapsed_ms"]),
                },
            })

        output.register_callback("connect4.bot_move", _bot_move_callback)
        output.register_callback("connect4.compare", _compare_callback)
        print("[Colab Python Kernel Terhubung] Bot AI & Benchmark mengeksekusi kernel Python Colab.")
    else:
        if is_colab:
            print("[Colab Mode Standby] Callback Python tidak terikat; UI berjalan dengan engine JS lokal.")
        else:
            print("[Mode Notebook Lokal] google.colab tidak aktif; UI berjalan dengan engine JS lokal 1:1.")

    try:
        html_content = build_retro_ui_html()
        display(HTML(html_content))
        return True
    except Exception as e:
        print(f"[Peringatan] Gagal memuat Retro UI: {e}")
        print("Silakan gunakan mode konsol play_game() pada sel Bagian 6A.")
        return False
