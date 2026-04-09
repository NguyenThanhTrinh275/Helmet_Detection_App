import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'True'

import io
import cv2
import base64
import tempfile
import asyncio
import numpy as np
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from model_loader import get_model, CLASS_NAMES

app = FastAPI(title="Helmet Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IMG_SIZE = 640
CONF_THRESHOLD = 0.25

# ============================================================
#  Helpers
# ============================================================

def _encode_image(img_bgr: np.ndarray, quality: int = 85) -> str:
    """Encode ảnh BGR sang base64 JPEG."""
    _, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buf.tobytes()).decode("utf-8")


def _detect_and_draw(img_bgr: np.ndarray, conf: float = CONF_THRESHOLD):
    """Chạy detection và trả về ảnh đã vẽ + danh sách detections."""
    model = get_model()
    results = model.predict(source=img_bgr, imgsz=IMG_SIZE, conf=conf, verbose=False)
    result = results[0]

    # Vẽ bounding box lên ảnh
    annotated = result.plot(line_width=2, font_size=12)

    detections = []
    for box in result.boxes:
        cls_id = int(box.cls[0])
        detections.append({
            "class": CLASS_NAMES.get(cls_id, str(cls_id)),
            "confidence": round(float(box.conf[0]), 3),
            "bbox": [round(v, 1) for v in box.xyxy[0].tolist()],
        })

    return annotated, detections


# ============================================================
#  1. API: Detect ảnh đơn lẻ
# ============================================================

@app.post("/api/detect/image")
async def detect_image(
    file: UploadFile = File(...),
    conf: float = Query(CONF_THRESHOLD, ge=0.05, le=1.0),
):
    """Upload ảnh → trả về ảnh đã vẽ bbox (base64) + detections."""
    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:  # 20 MB limit
        return JSONResponse(status_code=413, content={"error": "File quá lớn (tối đa 20MB)"})

    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return JSONResponse(status_code=400, content={"error": "Không thể đọc file ảnh"})

    annotated, detections = _detect_and_draw(img, conf)

    return {
        "image": _encode_image(annotated),
        "detections": detections,
        "total": len(detections),
    }


# ============================================================
#  2. API: Detect video (trích frame)
# ============================================================

@app.post("/api/detect/video")
async def detect_video(
    file: UploadFile = File(...),
    conf: float = Query(CONF_THRESHOLD, ge=0.05, le=1.0),
    interval: float = Query(2.0, ge=0.5, le=30.0, description="Khoảng cách giữa các frame (giây)"),
):
    """Upload video → trích frame mỗi `interval` giây → trả về danh sách ảnh đã detect."""
    contents = await file.read()
    if len(contents) > 200 * 1024 * 1024:  # 200 MB limit
        return JSONResponse(status_code=413, content={"error": "File quá lớn (tối đa 200MB)"})

    # Ghi tạm ra file để OpenCV đọc
    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return JSONResponse(status_code=400, content={"error": "Không thể đọc file video"})

        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps
        frame_interval = int(fps * interval)

        frames_result = []
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_interval == 0:
                timestamp = round(frame_idx / fps, 2)
                annotated, detections = _detect_and_draw(frame, conf)
                frames_result.append({
                    "frame_index": frame_idx,
                    "timestamp": timestamp,
                    "image": _encode_image(annotated, quality=80),
                    "detections": detections,
                    "total": len(detections),
                })

            frame_idx += 1

            # Giới hạn tối đa 50 frame để không quá tải
            if len(frames_result) >= 50:
                break

        cap.release()

        return {
            "video_info": {
                "fps": round(fps, 2),
                "total_frames": total_frames,
                "duration": round(duration, 2),
                "interval": interval,
            },
            "frames": frames_result,
            "total_frames_processed": len(frames_result),
        }
    finally:
        os.unlink(tmp_path)


# ============================================================
#  3. WebSocket: Camera realtime
# ============================================================

@app.websocket("/ws/detect")
async def websocket_detect(websocket: WebSocket):
    """WebSocket nhận frame từ camera → trả về ảnh đã detect (base64)."""
    await websocket.accept()
    model = get_model()

    try:
        while True:
            # Nhận frame base64 từ client
            data = await websocket.receive_text()

            # Decode base64 → ảnh
            img_bytes = base64.b64decode(data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                await websocket.send_json({"error": "Invalid frame"})
                continue

            # Detect
            results = model.predict(source=img, imgsz=IMG_SIZE, conf=CONF_THRESHOLD, verbose=False)
            result = results[0]
            annotated = result.plot(line_width=2, font_size=12)

            detections = []
            for box in result.boxes:
                cls_id = int(box.cls[0])
                detections.append({
                    "class": CLASS_NAMES.get(cls_id, str(cls_id)),
                    "confidence": round(float(box.conf[0]), 3),
                })

            await websocket.send_json({
                "image": _encode_image(annotated, quality=70),
                "detections": detections,
                "total": len(detections),
            })

    except WebSocketDisconnect:
        print("Client ngắt kết nối WebSocket")
    except Exception as e:
        print(f"WebSocket error: {e}")


# ============================================================
#  Health check
# ============================================================

@app.get("/api/health")
async def health():
    return {"status": "ok", "model_loaded": get_model() is not None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
