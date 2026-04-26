@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

:root {
  --bg-dark: #0f172a;
  --bg-card: rgba(30, 41, 59, 0.7);
  --bg-card-hover: rgba(51, 65, 85, 0.8);
  
  --primary: #0ea5e9;
  --primary-glow: rgba(14, 165, 233, 0.4);
  --secondary: #10b981;
  --accent: #f59e0b;
  --danger: #ef4444;

  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  
  --glass-border: 1px solid rgba(255, 255, 255, 0.1);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --glass-blur: blur(12px);
  
  --radius-lg: 16px;
  --radius-md: 12px;
  --radius-sm: 8px;

  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  background-color: var(--bg-dark);
  color: var(--text-main);
  min-height: 100vh;
  background-image: 
    radial-gradient(circle at 15% 50%, rgba(14, 165, 233, 0.15), transparent 25%),
    radial-gradient(circle at 85% 30%, rgba(16, 185, 129, 0.15), transparent 25%);
  -webkit-font-smoothing: antialiased;
}

/* Glassmorphism Classes */
.glass-card {
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: var(--glass-border);
  box-shadow: var(--glass-shadow);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  transition: var(--transition);
}

.glass-card:hover {
  background: var(--bg-card-hover);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* Typography Utilities */
h1, h2, h3, h4 { color: var(--text-main); font-weight: 600; margin-bottom: 0.5rem; }
.text-muted { color: var(--text-muted); font-size: 0.9rem; }
.text-primary { color: var(--primary); }
.text-secondary { color: var(--secondary); }
.text-danger { color: var(--danger); }
.text-accent { color: var(--accent); }

.fw-bold { font-weight: 700; }
.uppercase { text-transform: uppercase; }
.text-xl { font-size: 2.5rem; line-height: 1.2; letter-spacing: -0.02em; }
.text-lg { font-size: 1.5rem; }

/* Grid & Layouts */
.grid { display: grid; gap: 1.5rem; }
.grid-cols-1 { grid-template-columns: 1fr; }
@media (min-width: 768px) {
  .md\:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
  .md\:grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
  .md\:grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
  .md\:layout { grid-template-columns: 1fr 300px; }
}

.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-column { display: flex; flex-direction: column; gap: 0.5rem; }

/* UI Elements */
.btn {
  background: rgba(255,255,255,0.05);
  color: var(--text-main);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 500;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.btn:hover { background: rgba(255,255,255,0.1); }
.btn-primary { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 15px var(--primary-glow); }
.btn-primary:hover { background: #0284c7; box-shadow: 0 0 20px var(--primary-glow); }
.btn-danger { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.5); color: #fca5a5; }
.btn-danger:hover { background: rgba(239,68,68,0.4); }

/* Table Styles */
.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.data-table th, .data-table td {
  padding: 1rem;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.data-table th {
  color: var(--text-muted);
  font-weight: 500;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.data-table tr:hover td {
  background: rgba(255,255,255,0.02);
}

/* Form Styles */
input[type="range"] {
  -webkit-appearance: none;
  width: 100%;
  background: transparent;
}
input[type="range"]::-webkit-slider-runnable-track {
  width: 100%;
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: var(--primary);
  margin-top: -5px;
  cursor: pointer;
  box-shadow: 0 0 10px var(--primary-glow);
}

/* Animations */
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fadeIn 0.5s ease forwards; }
.delay-100 { animation-delay: 0.1s; }
.delay-150 { animation-delay: 0.15s; }
.delay-200 { animation-delay: 0.2s; }
.delay-250 { animation-delay: 0.25s; }
.delay-300 { animation-delay: 0.3s; }
.delay-400 { animation-delay: 0.4s; }

/* Circular Progress Utilities */
.progress-ring {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: conic-gradient(var(--fill-color) var(--percentage), rgba(255,255,255,0.05) 0);
  box-shadow: inset 0 0 20px rgba(0,0,0,0.5), 0 0 20px var(--glow-color);
}
.progress-ring::before {
  content: "";
  position: absolute;
  width: 140px;
  height: 140px;
  background: var(--bg-card);
  border-radius: 50%;
}
.progress-ring-content {
  position: relative;
  z-index: 10;
  text-align: center;
}
