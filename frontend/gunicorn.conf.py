"""
Gunicorn configuration for the ISRO BAH 2026 dashboard.

Run from the `frontend/` directory:
    gunicorn -c gunicorn.conf.py app:app

Note: gunicorn is a Unix/Linux WSGI server and does not run on native Windows.
For local Windows use `python app.py` (dev server) or `waitress-serve`.
"""

import os

# Bind address — override with GUNICORN_BIND if needed.
bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8000")

# Keep worker count low: each worker loads its own copy of the ResNet18 model
# and the (heavy) lightkurve/torch stacks on first request.
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
threads = int(os.environ.get("GUNICORN_THREADS", "2"))

# A Box-Least-Squares period search and a MAST download can each take a while,
# so allow generous request timeouts.
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "120"))
graceful_timeout = 30

# The model loads lazily per worker on first request, so app preloading does not
# share its memory; leave it off to keep worker boot cheap and isolated.
preload_app = False

# Headless rendering: matplotlib must never try to open a display under gunicorn.
raw_env = ["MPLBACKEND=Agg"]

# Log to stdout/stderr so a process manager / container captures everything.
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOGLEVEL", "info")
