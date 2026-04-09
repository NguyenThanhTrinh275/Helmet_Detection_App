import { useState } from 'react'
import ImageDetect from "./components/ImageDetect";
import VideoDetect from "./components/VideoDetect";
import CameraDetect from "./components/CameraDetect";
import './App.css'

const TABS = [
	{ id: "image", label: "🖼️ Ảnh", component: ImageDetect },
	{ id: "video", label: "🎬 Video", component: VideoDetect },
	{ id: "camera", label: "📹 Camera", component: CameraDetect },
];

function App() {
  const [activeTab, setActiveTab] = useState("image");
  const ActiveComponent = TABS.find((t) => t.id === activeTab).component;

  return (
		<div className="app">
			<header className="app-header">
				<h1>🛡️ Helmet Detection</h1>
				<p>Ứng dụng phát hiện mũ bảo hiểm sử dụng AI (YOLOv8)</p>
			</header>

			<nav className="tab-nav">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
						onClick={() => setActiveTab(tab.id)}
					>
						{tab.label}
					</button>
				))}
			</nav>

			<main className="main-content">
				<ActiveComponent />
			</main>

			<footer className="app-footer">
				<p>
					Helmet Detection &copy; 2026 — Powered by YOLOv8 + FastAPI +
					React
				</p>
			</footer>
		</div>
  );
}

export default App
