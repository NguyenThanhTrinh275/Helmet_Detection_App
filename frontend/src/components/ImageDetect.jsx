/** @format */

import { useState, useRef, useCallback } from "react";
import "./ImageDetect.css";

const BASE_URL = import.meta.env.VITE_API_URL || "";
const API_URL = `${BASE_URL}/api/detect/image`;

export default function ImageDetect() {
	const [preview, setPreview] = useState(null);
	const [result, setResult] = useState(null);
	const [loading, setLoading] = useState(false);
	const [conf, setConf] = useState(0.25);
	const [dragOver, setDragOver] = useState(false);
	const fileRef = useRef(null);

	const handleFile = useCallback((file) => {
		if (!file || !file.type.startsWith("image/")) return;
		setResult(null);
		const reader = new FileReader();
		reader.onload = (e) => setPreview(e.target.result);
		reader.readAsDataURL(file);
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
		try {
			const form = new FormData();
			form.append("file", fileRef.current);
			const res = await fetch(`${API_URL}?conf=${conf}`, {
				method: "POST",
				body: form,
			});
			if (!res.ok) {
				const err = await res.json();
				alert(err.error || "Lỗi server");
				return;
			}
			setResult(await res.json());
		} catch (err) {
			alert("Không thể kết nối server: " + err.message);
		} finally {
			setLoading(false);
		}
	};

	const reset = () => {
		setPreview(null);
		setResult(null);
		fileRef.current = null;
	};

	return (
		<div className="detect-panel">
			<h2>🖼️ Phát hiện trên Ảnh</h2>
			<p className="desc">
				Upload ảnh để phát hiện mũ bảo hiểm. Kết quả sẽ hiển thị
				bounding box trên ảnh.
			</p>

			{!preview && (
				<div
					className={`drop-zone ${dragOver ? "drag-over" : ""}`}
					onDragOver={(e) => {
						e.preventDefault();
						setDragOver(true);
					}}
					onDragLeave={() => setDragOver(false)}
					onDrop={handleDrop}
					onClick={() => document.getElementById("img-input").click()}
				>
					<span className="drop-icon">📁</span>
					<p>
						Kéo thả ảnh vào đây hoặc{" "}
						<strong>click để chọn file</strong>
					</p>
					<p className="hint">
						Hỗ trợ: JPG, PNG, BMP, WEBP (tối đa 20MB)
					</p>
					<input
						id="img-input"
						type="file"
						accept="image/*"
						hidden
						onChange={(e) => handleFile(e.target.files[0])}
					/>
				</div>
			)}

			{preview && !result && (
				<div className="preview-section">
					<img src={preview} alt="Preview" className="preview-img" />
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
						<div className="btn-group">
							<button
								className="btn primary"
								onClick={detect}
								disabled={loading}
							>
								{loading ? "⏳ Đang xử lý..." : "🔍 Phát hiện"}
							</button>
							<button className="btn secondary" onClick={reset}>
								↩️ Chọn lại
							</button>
						</div>
					</div>
				</div>
			)}

			{result && (
				<div className="result-section">
					<div className="result-img-wrap">
						<img
							src={`data:image/jpeg;base64,${result.image}`}
							alt="Result"
							className="result-img"
						/>
					</div>
					<div className="result-info">
						<h3>Kết quả: {result.total} đối tượng</h3>
						{result.detections.length > 0 ? (
							<table className="det-table">
								<thead>
									<tr>
										<th>#</th>
										<th>Loại</th>
										<th>Độ tin cậy</th>
									</tr>
								</thead>
								<tbody>
									{result.detections.map((d, i) => (
										<tr
											key={i}
											className={
												d.class === "no helmet"
													? "no-helmet"
													: "helmet"
											}
										>
											<td>{i + 1}</td>
											<td>
												{d.class === "helmet"
													? "✅ Có mũ"
													: "❌ Không mũ"}
											</td>
											<td>
												{(d.confidence * 100).toFixed(
													1,
												)}
												%
											</td>
										</tr>
									))}
								</tbody>
							</table>
						) : (
							<p>Không phát hiện đối tượng nào.</p>
						)}
						<button
							className="btn secondary"
							onClick={reset}
							style={{ marginTop: 16 }}
						>
							📷 Thử ảnh khác
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
