import os

from flask import Flask, render_template, request, jsonify, send_from_directory

import model_service
import pipeline

app = Flask(__name__)

# Cap uploads at 32 MB — light-curve CSVs and PNGs are well under this.
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")


@app.route("/assets/<path:filename>")
def assets(filename):
    """Serve static brand assets (icon, etc.) from the assets/ folder."""
    return send_from_directory(ASSETS_DIR, filename)


@app.route("/")
def index():
    return render_template(
        "index.html",
        model_status=model_service.model_status(),
        pipeline_available=pipeline.pipeline_available(),
    )


@app.route("/api/model-status")
def model_status():
    return jsonify(model_service.model_status())


@app.route("/predict", methods=["POST"])
def predict():
    """Classify a pre-rendered phase-folded light-curve image."""
    file = request.files.get("image")
    if file is None or file.filename == "":
        return jsonify({"ok": False, "error": "No image uploaded."}), 400
    try:
        result = model_service.predict_image(file.read())
        result["ok"] = True
        return jsonify(result)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/analyze/csv", methods=["POST"])
def analyze_csv():
    """Run the full pipeline on an uploaded time/flux CSV."""
    file = request.files.get("file")
    if file is None or file.filename == "":
        return jsonify({"ok": False, "error": "No CSV uploaded."}), 400
    try:
        return jsonify(pipeline.run_csv(file.read()))
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/analyze/tic", methods=["POST"])
def analyze_tic():
    """Download a TESS light curve by TIC ID and run the full pipeline."""
    tic_id = (request.form.get("tic_id") or "").strip()
    if not tic_id:
        return jsonify({"ok": False, "error": "No TIC ID provided."}), 400
    try:
        return jsonify(pipeline.run_tic(tic_id))
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True)
