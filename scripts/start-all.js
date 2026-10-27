#!/usr/bin/env node
/**
 * Concurrently starts both FastAPI backend (:8000) and Vite frontend (:5173).
 * Works on Windows, macOS, and Linux.
 * Handles spaces in paths and cleanly terminates both processes on CTRL+C.
 */

const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT_DIR = path.resolve(__dirname, "..");
const BACKEND_DIR = path.join(ROOT_DIR, "backend");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const isWin = process.platform === "win32";

// Resolve Python executable in .venv
function resolvePython() {
  const venvPythonWin = path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe");
  const venvPythonUnix = path.join(BACKEND_DIR, ".venv", "bin", "python");

  if (isWin && fs.existsSync(venvPythonWin)) {
    return venvPythonWin;
  }
  if (!isWin && fs.existsSync(venvPythonUnix)) {
    return venvPythonUnix;
  }

  return isWin ? "python" : "python3";
}

const pythonBin = resolvePython();
const npmCmd = isWin ? "npm.cmd" : "npm";

console.log("\x1b[32m%s\x1b[0m", "============================================================");
console.log("\x1b[32m%s\x1b[0m", " Starting Karnataka AI Travel Planner Full Stack Dev Server ");
console.log("\x1b[32m%s\x1b[0m", "============================================================");
console.log(`[system] Backend Python:  ${pythonBin}`);
console.log(`[system] Backend API:     http://localhost:8000 (docs at /docs)`);
console.log(`[system] Frontend App:    http://localhost:5173`);
console.log("Press CTRL+C to stop both servers.\n");

// Spawn Backend (shell: false prevents cmd.exe space-splitting bugs on Windows)
const backendProc = spawn(pythonBin, ["-m", "uvicorn", "app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"], {
  cwd: BACKEND_DIR,
  stdio: ["inherit", "pipe", "pipe"],
  shell: false,
});

backendProc.stdout.on("data", (data) => {
  process.stdout.write(`\x1b[36m[backend]\x1b[0m ${data}`);
});
backendProc.stderr.on("data", (data) => {
  process.stderr.write(`\x1b[36m[backend]\x1b[0m ${data}`);
});
backendProc.on("error", (err) => {
  console.error(`\x1b[31m[backend error]\x1b[0m ${err.message}`);
});

// Spawn Frontend
const frontendProc = spawn(npmCmd, ["run", "dev"], {
  cwd: FRONTEND_DIR,
  stdio: ["inherit", "pipe", "pipe"],
  shell: isWin,
});

frontendProc.stdout.on("data", (data) => {
  process.stdout.write(`\x1b[35m[frontend]\x1b[0m ${data}`);
});
frontendProc.stderr.on("data", (data) => {
  process.stderr.write(`\x1b[35m[frontend]\x1b[0m ${data}`);
});
frontendProc.on("error", (err) => {
  console.error(`\x1b[31m[frontend error]\x1b[0m ${err.message}`);
});

// Cleanup handler
let isShuttingDown = false;
function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("\n\x1b[33m[system] Shutting down both servers...\x1b[0m");

  if (isWin) {
    try {
      if (backendProc.pid) execSync(`taskkill /pid ${backendProc.pid} /T /F`, { stdio: "ignore" });
    } catch {}
    try {
      if (frontendProc.pid) execSync(`taskkill /pid ${frontendProc.pid} /T /F`, { stdio: "ignore" });
    } catch {}
  } else {
    try {
      backendProc.kill("SIGTERM");
    } catch {}
    try {
      frontendProc.kill("SIGTERM");
    } catch {}
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", shutdown);
