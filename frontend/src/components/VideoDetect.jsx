/** @format */

import { useState, useRef, useCallback } from "react";
import "./VideoDetect.css";

const API_URL = "/api/detect/video";

export default function VideoDetect() {
	const [videoPreview, setVideoPreview] = useState(null);
	const [result, setResult] = useState(null);
	const [loading, setLoading] = useState(false);
	const [progress, setProgress] = useState("");
	const [conf, setConf] = useState(0.25);
	const [interval, setInterval_] = useState(2);
	const [dragOver, setDragOver] = useState(false);
	const fileRef = useRef(null);

	const handleFile = useCallback((file) => {
		if (!file || !file.type.startsWith("video/")) return;
		setResult(null);
		setVideoPreview(URL.createObjectURL(file));
		fileRef.current = file;
	}, []);

	const handleDrop = (e) => {
		e.preventDefault();
		setDragOver(false);
		handleFile(e.dataTransfer.files[0]);
	};

	const detect = async () => {
		if (!fileRef.current) return;
		setLoading(true);
		setProgress("Đang upload video...");
		try {
			const form = new FormData();
			form.append("file", fileRef.current);
			setProgress("Đang xử lý video, vui lòng chờ...");
			const res = await fetch(
				`${API_URL}?conf=${conf}&interval=${interval}`,
				{ method: "POST", body: form },
			);
			if (!res.ok) {
				const err = await res.json();
				alert(err.error || "Lỗi server");
				return;
			}
			setResult(await res.json());
			setProgress("");
		} catch (err) {
			alert("Không thể kết nối server: " + err.message);
		} finally {
			setLoading(false);
		}
	};

	const reset = () => {
		if (videoPreview) URL.revokeObjectURL(videoPreview);
		setVideoPreview(null);
		setResult(null);
		fileRef.current = null;
		setProgress("");
	};

	return (
		<div className="detect-panel">
			<h2>🎬 Phát hiện trên Video</h2>
			<p className="desc">
				Upload video, hệ thống sẽ trích xuất frame theo khoảng thời gian
				và phát hiện mũ bảo hiểm.
			</p>

			{!videoPreview && (
				<div
					className={`drop-zone ${dragOver ? "drag-over" : ""}`}
					onDragOver={(e) => {
						e.preventDefault();
						setDragOver(true);
					}}
					onDragLeave={() => setDragOver(false)}
					onDrop={handleDrop}
					onClick={() => document.getElementById("vid-input").click()}
				>
					<span className="drop-icon">🎥</span>
					<p>
						Kéo thả video vào đây hoặc{" "}
						<strong>click để chọn file</strong>
					</p>
					<p className="hint">
						Hỗ trợ: MP4, AVI, MOV, MKV (tối đa 200MB)
					</p>
					<input
						id="vid-input"
						type="file"
						accept="video/*"
						hidden
						onChange={(e) => handleFile(e.target.files[0])}
					/>
				</div>
			)}

			{videoPreview && !result && (
				<div className="preview-section">
					<video
						src={videoPreview}
						controls
						className="preview-video"
					/>
					<div className="controls">
						<label>
							Confidence: <strong>{conf}</strong>
							<input
								type="range"
								min="0.05"
								max="1"
								step="0.05"
								value={conf}
								onChange={(e) =>
									setConf(parseFloat(e.target.value))
								}
							/>
						</label>
						<label>
							Khoảng cách frame: <strong>{interval}s</strong>
							<input
								type="range"
								min="0.5"
								max="10"
								step="0.5"
								value={interval}
								onChange={(e) =>
									setInterval_(parseFloat(e.target.value))
								}
							/>
						</label>
						<div className="btn-group">
							<button
								className="btn primary"
								onClick={detect}
								disabled={loading}
							>
								{loading ? "⏳ Đang xử lý..." : "🔍 Phát hiện"}
							</button>
							<button
								className="btn secondary"
								onClick={reset}
								disabled={loading}
							>
								↩️ Chọn lại
							</button>
						</div>
						{progress && (
							<p className="progress-text">{progress}</p>
						)}
					</div>
				</div>
			)}

			{result && (
				<div className="video-result">
					<div className="video-info">
						<h3>📊 Thông tin video</h3>
						<p>
							FPS: {result.video_info.fps} | Thời lượng:{" "}
							{result.video_info.duration}s | Tổng frame xử lý:{" "}
							{result.total_frames_processed}
						</p>
					</div>

					<div className="frames-grid">
						{result.frames.map((frame, i) => (
							<div key={i} className="frame-card">
								<img
									src={`data:image/jpeg;base64,${frame.image}`}
									alt={`Frame ${i}`}
								/>
								<div className="frame-meta">
									<span className="timestamp">
										⏱ {frame.timestamp}s
									</span>
									<span className="count">
										{frame.detections.filter(
											(d) => d.class === "no helmet",
										).length > 0
											? `❌ ${frame.detections.filter((d) => d.class === "no helmet").length} không mũ`
											: "✅ Tất cả có mũ"}{" "}
										| {frame.total} đối tượng
									</span>
								</div>
							</div>
						))}
					</div>

					<button
						className="btn secondary"
						onClick={reset}
						style={{ marginTop: 20 }}
					>
						🎬 Thử video khác
					</button>
				</div>
			)}
		</div>
	);
}
