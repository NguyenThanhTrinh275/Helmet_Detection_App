#!/bin/bash
# ================================================
# Deploy Helmet Detection lên Google Cloud Run
# ================================================
# Yêu cầu: 
#   - Đã cài Google Cloud SDK (gcloud)
#   - Đã đăng nhập: gcloud auth login
#   - Đã tạo project trên GCP

set -e

# ============ CẤU HÌNH ============
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"      # Thay bằng Project ID của bạn
REGION="${GCP_REGION:-asia-southeast1}"                # Region gần Việt Nam
SERVICE_NAME="helmet-detection"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "=== Deploy Helmet Detection lên GCP Cloud Run ==="
echo "Project: ${PROJECT_ID}"
echo "Region:  ${REGION}"
echo "Image:   ${IMAGE_NAME}"
echo ""

# 1. Set project
echo "[1/5] Cấu hình project..."
gcloud config set project ${PROJECT_ID}

# 2. Enable các API cần thiết
echo "[2/5] Enable APIs..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com

# 3. Build Docker image bằng Cloud Build (không cần Docker local)
echo "[3/5] Build Docker image trên Cloud Build..."
gcloud builds submit --tag ${IMAGE_NAME} --timeout=1800

# 4. Deploy lên Cloud Run
echo "[4/5] Deploy lên Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --max-instances 3 \
    --min-instances 0 \
    --port 8080 \
    --set-env-vars "MODEL_WEIGHTS_PATH=/app/weights/best.pt"

# 5. Lấy URL
echo ""
echo "[5/5] Deploy thành công!"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo "URL: ${SERVICE_URL}"
