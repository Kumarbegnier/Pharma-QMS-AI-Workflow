# AIVOA Pharma QMS — One-click startup script
# Run from: C:\Users\cuk18\.gemini\antigravity\scratch\pharma-qms-complaints\

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = Join-Path $ROOT "backend"
$FRONTEND = Join-Path $ROOT "frontend"
$PYTHON = "C:\Users\cuk18\AppData\Local\Programs\Python\Python310\python.exe"
$NODE_PATH = "C:\Users\cuk18\AppData\Local\OpenAI\Codex\runtimes\cua_node\23828fd353da361d\bin"

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  AIVOA Pharma QMS — Starting Up" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Start Backend
Write-Host "Starting FastAPI backend on port 8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BACKEND'; $PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

# Wait for backend to boot
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Vite frontend on port 5173..." -ForegroundColor Green
$env:PATH = "$NODE_PATH;$env:PATH"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FRONTEND'; `$env:PATH='$NODE_PATH;' + `$env:PATH; npm run dev"

# Wait for Vite
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Both servers are starting!" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor Yellow
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Open browser
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"
