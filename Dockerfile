# ====== Backend-only Dockerfile (FE deploy riêng trên Firebase) ======
FROM python:3.10-slim

# Cài các thư viện hệ thống cần cho OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cài đặt Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy model weights
COPY ai-model/runs/helmet_detect/weights/best.pt ./weights/best.pt
ENV MODEL_WEIGHTS_PATH=/app/weights/best.pt

# Port mặc định Cloud Run
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
