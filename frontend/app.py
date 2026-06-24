from flask import Flask, render_template, request, jsonify

import model_service

app = Flask(__name__)

# Cap uploads at 8 MB — phase-folded light-curve PNGs are tiny.
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024


@app.route("/")
def index():
    return render_template("index.html", model_status=model_service.model_status())


@app.route("/api/model-status")
def model_status():
    return jsonify(model_service.model_status())


@app.route("/predict", methods=["POST"])
def predict():
    file = request.files.get("image")
    if file is None or file.filename == "":
        return jsonify({"ok": False, "error": "No image uploaded."}), 400
    try:
        result = model_service.predict_image(file.read())
        result["ok"] = True
        return jsonify(result)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True)
