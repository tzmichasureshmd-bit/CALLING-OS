#!/bin/bash
# CALLOS Quick Start Script
# Run this to start everything locally in one command

echo "🚀 CALLOS Quick Start"
echo "====================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if directories exist
if [ ! -d "backend" ] || [ ! -d "web" ] || [ ! -d "mobile" ]; then
    echo -e "${RED}❌ Error: Run this script from the CALLOS root directory${NC}"
    exit 1
fi

# Function to start a service in background
start_service() {
    local name=$1
    local dir=$2
    local cmd=$3
    
    echo -e "${YELLOW}Starting $name...${NC}"
    (cd "$dir" && eval "$cmd" > "${name}.log" 2>&1 &)
    echo "$!" > "${dir}/.pid"
    echo -e "${GREEN}✅ $name started (PID: $(cat ${dir}/.pid))${NC}"
}

# 1. Backend
echo ""
echo "1️⃣  Backend"
echo "----------"
if ! command -v python &> /dev/null; then
    echo -e "${RED}❌ Python not found. Install Python 3.10+${NC}"
    exit 1
fi

if [ ! -d "backend/venv" ]; then
    echo "📦 Creating virtual environment..."
    (cd backend && python -m venv venv)
fi

echo "📥 Activating venv and installing dependencies..."
if [ -f "backend/venv/bin/activate" ]; then
    source backend/venv/bin/activate
    cd backend && pip install -q -r requirements.txt 2>/dev/null && cd ..
fi

start_service "Backend" "backend" "source venv/bin/activate && uvicorn app.main:app --reload --port 8000"
sleep 2

# 2. Web Dashboard
echo ""
echo "2️⃣  Web Dashboard"
echo "----------------"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ NPM not found. Install Node.js${NC}"
    exit 1
fi

if [ ! -d "web/node_modules" ]; then
    echo "📥 Installing web dependencies..."
    (cd web && npm install -q)
fi

start_service "Web" "web" "npm run dev"
sleep 2

# 3. Mobile
echo ""
echo "3️⃣  Mobile"
echo "----------"
if [ ! -d "mobile/node_modules" ]; then
    echo "📥 Installing mobile dependencies..."
    (cd mobile && npm install -q)
fi

start_service "Mobile" "mobile" "npx expo start"
sleep 1

# Print summary
echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "📍 URLs:"
echo "  • Backend:  http://localhost:8000"
echo "  • Docs:     http://localhost:8000/docs"
echo "  • Web:      http://localhost:5173"
echo "  • Mobile:   Check Expo terminal (press 'a' for Android emulator)"
echo ""
echo "📝 Logs:"
echo "  • Backend:  tail -f backend/backend.log"
echo "  • Web:      tail -f web/web.log"
echo "  • Mobile:   tail -f mobile/mobile.log"
echo ""
echo "🧪 Run tests:"
echo "  • cd backend && python test_e2e_sync.py"
echo ""
echo "🛑 Stop all services:"
echo "  • pkill -f 'uvicorn\\|npm run dev\\|expo start'"
echo ""
