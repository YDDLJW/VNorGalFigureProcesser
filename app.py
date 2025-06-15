# app.py

import base64
import os
import io
import json
import webbrowser
from flask import Flask, render_template, request, jsonify
from PIL import Image
from tkinter import Tk, filedialog

app = Flask(__name__, static_folder="static", template_folder="templates")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/save_image", methods=["POST"])
def save_image():
    data = request.json.get("imageData")
    root = Tk()
    root.withdraw()
    file_path = filedialog.asksaveasfilename(
        defaultextension=".png",
        filetypes=[("PNG files","*.png")]
    )
    if not file_path:
        return jsonify({"status": "cancelled"}), 400
    header, encoded = data.split(",", 1)
    img = Image.open(io.BytesIO(base64.b64decode(encoded)))
    img.save(file_path)
    return jsonify({"status": "ok", "path": file_path})

@app.route("/api/save_coords", methods=["POST"])
def save_coords():
    coords = request.json.get("coords")
    root = Tk()
    root.withdraw()
    file_path = filedialog.asksaveasfilename(
        defaultextension=".json",
        filetypes=[("JSON files","*.json")]
    )
    if not file_path:
        return jsonify({"status": "cancelled"}), 400
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(coords, f, ensure_ascii=False, indent=2)
    return jsonify({"status": "ok", "path": file_path})

if __name__ == "__main__":
    port = 5000
    url = f"http://127.0.0.1:{port}"
    # Only open browser once (avoid double-open when Flask reloader kicks in)
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        webbrowser.open(url)
    app.run(port=port, debug=True)
