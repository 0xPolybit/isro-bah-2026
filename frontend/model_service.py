"""
TESSNet inference service.

Wraps the trained ResNet18 checkpoint (`tess_resnet18_model.pth`) produced by
`model/tessnet.ipynb`. The notebook fine-tunes a torchvision ResNet18 by
replacing the final fully-connected layer with `Linear(512, num_classes)` and
trains on 224x224 RGB images of *phase-folded light curves* (black scatter on a
white background), normalised with the standard ImageNet statistics.

Inference mirrors the notebook's `predict_and_evaluate`: load an image, resize +
normalise, run a forward pass, softmax the logits, and report the top class with
its confidence.
"""

import io
import os
import threading

MODEL_PATH = os.path.join(os.path.dirname(__file__), "tess_resnet18_model.pth")

# The checkpoint stores 2 output neurons but NOT the class names. torchvision's
# ImageFolder assigns labels alphabetically, so index 0 is the alphabetically
# first training folder. The notebook's candidate folders were
# {eclipsing_binaries, noise, transits}; only two survived training.
# --- Adjust this single list if the training class set differs. ---
CLASS_NAMES = ["noise", "transits"]

# Human-readable labels for any class name we might encounter.
FRIENDLY = {
    "noise": "Noise / No Transit",
    "transits": "Planetary Transit",
    "eclipsing_binaries": "Eclipsing Binary",
}

# Which class names count as a positive exoplanet-transit detection.
POSITIVE_CLASSES = {"transits"}

# ImageNet normalisation (matches the notebook's transforms).
_MEAN = [0.485, 0.456, 0.406]
_STD = [0.229, 0.224, 0.225]

_lock = threading.Lock()
_model = None
_transform = None
_load_error = None


def _load():
    """Lazily build the network and load weights. Safe to call repeatedly."""
    global _model, _transform, _load_error
    if _model is not None or _load_error is not None:
        return
    try:
        import torch  # noqa: F401
        import torch.nn as nn
        from torchvision import models, transforms

        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Checkpoint not found: {MODEL_PATH}")

        net = models.resnet18(weights=None)
        net.fc = nn.Linear(net.fc.in_features, len(CLASS_NAMES))
        state = torch.load(MODEL_PATH, map_location="cpu")
        net.load_state_dict(state)
        net.eval()

        _model = net
        _transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=_MEAN, std=_STD),
        ])
    except Exception as exc:  # torch missing, bad checkpoint, etc.
        _load_error = f"{type(exc).__name__}: {exc}"


def model_status():
    """Return a small dict describing whether the model is ready."""
    _load()
    if _model is not None:
        return {
            "ready": True,
            "classes": [
                {"name": n, "label": FRIENDLY.get(n, n)} for n in CLASS_NAMES
            ],
        }
    return {"ready": False, "error": _load_error}


def predict_image(file_bytes):
    """Classify a phase-folded light-curve image. Returns a result dict."""
    _load()
    if _model is None:
        raise RuntimeError(_load_error or "Model unavailable")

    import torch
    from PIL import Image

    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    with _lock:
        tensor = _transform(image).unsqueeze(0)
        with torch.no_grad():
            logits = _model(tensor)[0]
            probs = torch.softmax(logits, dim=0).tolist()

    order = sorted(range(len(CLASS_NAMES)), key=lambda i: probs[i], reverse=True)
    top = order[0]
    top_name = CLASS_NAMES[top]

    return {
        "predicted": top_name,
        "predicted_label": FRIENDLY.get(top_name, top_name),
        "confidence": probs[top],
        "transit_detected": top_name in POSITIVE_CLASSES,
        "probabilities": [
            {
                "name": CLASS_NAMES[i],
                "label": FRIENDLY.get(CLASS_NAMES[i], CLASS_NAMES[i]),
                "p": probs[i],
            }
            for i in range(len(CLASS_NAMES))
        ],
    }
