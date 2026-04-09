import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'True'

from pathlib import Path
from ultralytics import YOLO

# Đường dẫn tới model weights
WEIGHTS_PATH = Path(__file__).resolve().parent.parent / "ai-model" / "runs" / "helmet_detect" / "weights" / "best.pt"

_model = None

def get_model() -> YOLO:
    """Load model một lần duy nhất (singleton)."""
    global _model
    if _model is None:
        if not WEIGHTS_PATH.exists():
            raise FileNotFoundError(f"Không tìm thấy model tại: {WEIGHTS_PATH}")
        _model = YOLO(str(WEIGHTS_PATH))
        print(f"Đã load model từ: {WEIGHTS_PATH}")
    return _model

CLASS_NAMES = {0: "helmet", 1: "no helmet"}
