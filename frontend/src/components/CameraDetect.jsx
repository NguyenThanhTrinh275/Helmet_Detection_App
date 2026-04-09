/** @format */

import { useState, useRef, useEffect, useCallback } from "react";
import "./CameraDetect.css";

export default function CameraDetect() {
	const [active, setActive] = useState(false);
	const [resultImg, setResultImg] = useState(null);
	const [stats, setStats] = useState(null);
	const [fps, setFps] = useState(0);
	const [error, setError] = useState("");

	const videoRef = useRef(null);
	const canvasRef = useRef(null);
	const wsRef = useRef(null);
	const streamRef = useRef(null);
	const sendingRef = useRef(false);
	const frameCountRef = useRef(0);
	const fpsIntervalRef = useRef(null);

	const sendFrame = useCallback(() => {
		const loop = () => {
			if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
				return;
			if (!videoRef.current || !canvasRef.current) return;

			const video = videoRef.current;
			if (video.readyState < 2 || video.videoWidth === 0) {
				requestAnimationFrame(loop);
				return;
			}

			if (!sendingRef.current) {
				sendingRef.current = true;
				const canvas = canvasRef.current;
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				const ctx = canvas.getContext("2d");
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

				canvas.toBlob(
					(blob) => {
						if (
							blob &&
							wsRef.current &&
							wsRef.current.readyState === WebSocket.OPEN
						) {
							blob.arrayBuffer().then((buf) => {
								const base64 = btoa(
									new Uint8Array(buf).reduce(
										(data, byte) =>
											data + String.fromCharCode(byte),
										"",
									),
								);
								wsRef.current.send(base64);
							});
						} else {
							sendingRef.current = false;
						}
					},
					"image/jpeg",
					0.7,
				);
			}

			requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
	}, []);

	const startWs = useCallback(() => {
		// Kết nối WebSocket
		const protocol = window.location.protocol === "https:" ? "wss" : "ws";
		const wsUrl = `${protocol}://${window.location.host}/ws/detect`;
		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.onopen = () => {
			setActive(true);
			sendFrame();
		};

		ws.onmessage = (evt) => {
			const data = JSON.parse(evt.data);
			if (data.image) {
				setResultImg(`data:image/jpeg;base64,${data.image}`);
				setStats({
					total: data.total,
					detections: data.detections,
				});
				frameCountRef.current++;
			}
			sendingRef.current = false;
		};

		ws.onerror = () => {
			setError("Lỗi kết nối WebSocket. Kiểm tra backend đang chạy.");
		};

		ws.onclose = () => {
			setActive(false);
		};

		// Tính FPS
		fpsIntervalRef.current = window.setInterval(() => {
			setFps(frameCountRef.current);
			frameCountRef.current = 0;
		}, 1000);
	}, [sendFrame]);

	const start = useCallback(async () => {
		setError("");
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { width: 640, height: 480, facingMode: "user" },
			});
			streamRef.current = stream;
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				// Đợi video thực sự sẵn sàng (có frame) rồi mới kết nối WS
				videoRef.current.onloadedmetadata = () => {
					videoRef.current.play().then(() => {
						startWs();
					});
				};
			}
		} catch (err) {
			setError("Không thể truy cập camera: " + err.message);
		}
	}, [startWs]);

	const stop = useCallback(() => {
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((t) => t.stop());
			streamRef.current = null;
		}
		if (fpsIntervalRef.current) {
			clearInterval(fpsIntervalRef.current);
		}
		setActive(false);
		setResultImg(null);
		setStats(null);
		setFps(0);
		sendingRef.current = false;
	}, []);

	useEffect(() => {
		return () => stop();
	}, [stop]);

	const noHelmetCount =
		stats?.detections?.filter((d) => d.class === "no helmet").length || 0;
	const helmetCount =
		stats?.detections?.filter((d) => d.class === "helmet").length || 0;

	return (
		<div className="detect-panel camera-panel">
			<h2>📹 Camera Realtime</h2>
			<p className="desc">
				Sử dụng camera để phát hiện mũ bảo hiểm theo thời gian thực.
			</p>

			{error && <p className="error-msg">⚠️ {error}</p>}

			<div className="camera-layout">
				{/* Video ẩn dùng để capture frame */}
				<video
					ref={videoRef}
					autoPlay
					playsInline
					muted
					style={{ display: "none" }}
				/>
				<canvas ref={canvasRef} style={{ display: "none" }} />

				<div className="camera-feed">
					{!active && !resultImg && (
						<div className="camera-placeholder">
							<span>📹</span>
							<p>Camera chưa bật</p>
						</div>
					)}
					{resultImg && (
						<img
							src={resultImg}
							alt="Detection result"
							className="camera-result-img"
						/>
					)}
				</div>

				<div className="camera-controls">
					{!active ? (
						<button className="btn primary btn-lg" onClick={start}>
							▶️ Bật Camera
						</button>
					) : (
						<button className="btn danger btn-lg" onClick={stop}>
							⏹ Tắt Camera
						</button>
					)}

					{active && stats && (
						<div className="live-stats">
							<div className="stat-badge fps-badge">
								FPS: {fps}
							</div>
							<div className="stat-badge total-badge">
								Tổng: {stats.total}
							</div>
							{helmetCount > 0 && (
								<div className="stat-badge helmet-badge">
									✅ Có mũ: {helmetCount}
								</div>
							)}
							{noHelmetCount > 0 && (
								<div className="stat-badge no-helmet-badge">
									❌ Không mũ: {noHelmetCount}
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
