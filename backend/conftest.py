import sys
from pathlib import Path

# Expose the standalone `ai` package (repo root) during tests.
_ROOT = str(Path(__file__).resolve().parents[1])
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
