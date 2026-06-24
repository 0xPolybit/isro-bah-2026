<div align="center">

# ISRO BAH 2026
### AI Exoplanet Transit Detection Pipeline

*The Escapists — Bharatiya Antariksh Hackathon 2026*

[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.x-EE4C2C?style=flat-square&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue?style=flat-square)](LICENSE)
[![TESS](https://img.shields.io/badge/Data-NASA%20TESS-0B3D91?style=flat-square)](https://tess.mit.edu/)
[![Chart.js](https://img.shields.io/badge/Charts-Chart.js-FF6384?style=flat-square&logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)

</div>

---

An AI-based pipeline and dashboard for **automatically detecting exoplanet transit signals in noisy astronomical light-curve data**. Transit photometry hunts for the tiny, periodic dips in a star's brightness caused by a planet crossing its disk. In crowded fields these signals are buried under detector noise and contamination from blended foreground/background sources, and they are easily confused with eclipsing binaries or starspots. This project pairs a deep-learning classifier with an interactive mission-control dashboard to surface and explain candidate transits.

---

## Features

| | |
|---|---|
| 📊 **Interactive Dashboard** | Visualises the full detection workflow across five panels: raw light curve, AI pipeline diagram, denoised signal, transit probability over time, and a phase-folded detection summary. |
| 🤖 **Live Model Inference** | Upload a phase-folded light-curve image and the trained ResNet18 classifier returns a verdict, confidence score, and per-class probability bars — updated in real time. |
| ❓ **Per-panel Help** | Every section has a `?` button that opens a contextual explanation of the data being displayed. |
| 🎨 **Design System** | Single-screen dark layout, sharp corners, greyscale + electric blue (`#00e8f7`), subtle animations. Documented in [`DESIGN.md`](DESIGN.md). |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | [Python](https://www.python.org/) · [Flask](https://flask.palletsprojects.com/) |
| **ML / Inference** | [PyTorch](https://pytorch.org/) · [torchvision](https://pytorch.org/vision/) (ResNet18) · [Pillow](https://python-pillow.org/) |
| **Frontend** | HTML · CSS · Vanilla JavaScript · [Chart.js](https://www.chartjs.org/) |
| **Model Training** | [Lightkurve](https://docs.lightkurve.org/) · [Astroquery](https://astroquery.readthedocs.io/) · NumPy |
| **Fonts** | [Bitcount Prop Single](https://fonts.google.com/) (headings) · [Ubuntu](https://fonts.google.com/specimen/Ubuntu) (body) |

---

## The Model

The classifier is a **ResNet18** fine-tuned on 224×224 RGB images of *phase-folded light curves* — black scatter on a white background — normalised with standard ImageNet statistics. The full training process is documented in [`model/tessnet.ipynb`](model/tessnet.ipynb).

```
Raw TESS Data  →  BLS Period Search  →  Phase-fold  →  Render Image  →  ResNet18 Fine-tune
```

1. **Download** TESS light curves via Lightkurve (SPOC pipeline).
2. **Clean** — remove NaNs, sigma-clip outliers, flatten the trend.
3. **BLS periodogram** — find the dominant period, epoch, and duration.
4. **Phase-fold** the light curve and render it as a 224×224 PNG.
5. **Fine-tune** a pre-trained ResNet18 with a custom classification head.

Trained weights ship as `frontend/tess_resnet18_model.pth`. Inference mirrors the notebook's `predict_and_evaluate` function exactly.

> **Class labels:** The checkpoint outputs **2 classes** but does not store their names. They default to `noise` (index 0) and `transits` (index 1), matching torchvision's alphabetical `ImageFolder` ordering. If your training set used a different pair, update the `CLASS_NAMES` list at the top of [`frontend/model_service.py`](frontend/model_service.py).

---

## Project Structure

```
isro-bah-2026/
│
├── DESIGN.md                    # Visual & interaction design principles
├── LICENSE                      # GNU GPL v3
├── README.md
│
├── model/
│   ├── tessnet.ipynb            # Data preparation + ResNet18 training
│   └── sample_data/             # Example light-curve samples
│
└── frontend/
    ├── app.py                   # Flask application & API routes
    ├── model_service.py         # Model loading, lazy init & inference
    ├── requirements.txt
    ├── tess_resnet18_model.pth  # Trained ResNet18 weights (~45 MB)
    │
    ├── templates/
    │   └── index.html           # Main dashboard template
    │
    └── static/
        ├── css/
        │   └── style.css        # Full design-system stylesheet
        └── js/
            ├── data.js          # Synthetic demo light-curve generator
            ├── charts.js        # Chart.js chart rendering
            ├── help.js          # Per-panel help modal
            └── predict.js       # Upload → /predict → live results
```

---

## Installation

> Requires **Python 3.9+**

```bash
# 1. Clone the repository
git clone https://github.com/<your-org>/isro-bah-2026.git
cd isro-bah-2026/frontend

# 2. Create and activate a virtual environment (recommended)
python -m venv env

# Windows
env\Scripts\activate
# macOS / Linux
source env/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

**PyTorch CPU-only install** (if the default wheel fails for your platform):

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

---

## Usage

Start the development server from the `frontend/` directory:

```bash
python app.py
```

Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your browser.

The dashboard loads with a synthetic demo light curve so all panels are pre-populated. To run the real classifier:

1. Navigate to the **Detection Result** panel (panel 5).
2. Click **Analyze Light-Curve Image**.
3. Upload a phase-folded light-curve PNG (black scatter, white background, any size).
4. The ResNet18 model classifies the image and updates the verdict, confidence, and probability bars live.

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serves the dashboard. |
| `GET` | `/api/model-status` | Returns model readiness and class labels as JSON. |
| `POST` | `/predict` | Accepts a multipart `image` upload, returns a JSON classification result. |

#### Example `/predict` response

```json
{
  "ok": true,
  "predicted": "transits",
  "predicted_label": "Planetary Transit",
  "confidence": 0.97,
  "transit_detected": true,
  "probabilities": [
    { "name": "transits", "label": "Planetary Transit",  "p": 0.97 },
    { "name": "noise",    "label": "Noise / No Transit", "p": 0.03 }
  ]
}
```

---

## License

Released under the [GNU General Public License v3.0](LICENSE).
