import os
import json
import dataclasses
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
from algorithms import NaiveSearch, RabinKarpSearch, KMPSearch, BoyerMooreSearch

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB limit

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALGORITHMS = {
    "naive": NaiveSearch,
    "rabin_karp": RabinKarpSearch,
    "kmp": KMPSearch,
    "boyer_moore": BoyerMooreSearch,
}


def dataclass_to_dict(obj):
    if dataclasses.is_dataclass(obj):
        return {k: dataclass_to_dict(v) for k, v in dataclasses.asdict(obj).items()}
    elif isinstance(obj, list):
        return [dataclass_to_dict(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: dataclass_to_dict(v) for k, v in obj.items()}
    return obj


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/algorithms", methods=["GET"])
def list_algorithms():
    return jsonify(
        [
            {"id": "naive", "name": "Naive (Brute Force)"},
            {"id": "rabin_karp", "name": "Rabin-Karp"},
            {"id": "kmp", "name": "Knuth-Morris-Pratt (KMP)"},
            {"id": "boyer_moore", "name": "Boyer-Moore"},
        ]
    )


@app.route("/api/upload", methods=["POST"])
def upload_file():
    if "files" not in request.files:
        return jsonify({"error": "No files part"}), 400

    files = request.files.getlist("files")
    uploaded = []

    for file in files:
        if file.filename == "":
            continue
        if file and file.filename.endswith(".txt"):
            filename = secure_filename(file.filename)
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            uploaded.append({"filename": filename, "content": content, "size": len(content)})

    if not uploaded:
        return jsonify({"error": "No valid .txt files uploaded"}), 400

    return jsonify({"files": uploaded})


@app.route("/api/search", methods=["POST"])
def search():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    text = data.get("text", "")
    pattern = data.get("pattern", "")
    algorithm_id = data.get("algorithm", "naive")
    all_algorithms = data.get("all_algorithms", False)

    if not text or not pattern:
        return jsonify({"error": "Text and pattern are required"}), 400

    if len(text) > 500_000:
        return jsonify({"error": "Text too large (max 500,000 characters)"}), 400

    # Limit steps to avoid huge payloads
    MAX_STEPS = 2000

    def run_algorithm(alg_id):
        AlgClass = ALGORITHMS.get(alg_id)
        if not AlgClass:
            return None
        alg = AlgClass()
        result = alg.search(text, pattern)
        result_dict = dataclass_to_dict(result)
        if len(result_dict["steps"]) > MAX_STEPS:
            result_dict["steps"] = result_dict["steps"][:MAX_STEPS]
            result_dict["steps_truncated"] = True
        return result_dict

    if all_algorithms:
        results = {}
        for alg_id in ALGORITHMS:
            results[alg_id] = run_algorithm(alg_id)
        return jsonify({"results": results, "mode": "compare"})
    else:
        result = run_algorithm(algorithm_id)
        if result is None:
            return jsonify({"error": f"Unknown algorithm: {algorithm_id}"}), 400
        return jsonify({"result": result, "mode": "single"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
