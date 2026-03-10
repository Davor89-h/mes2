#!/bin/bash
echo "🦌 Starting DEER MES v6 in development mode..."
echo ""
echo "Starting backend on port 3000..."
cd backend && npm install --silent && npm start &
BACKEND_PID=$!
sleep 3
echo ""
echo "Starting frontend on port 5173..."
cd ../frontend && npm install --silent && npm run dev &
FRONTEND_PID=$!
echo ""
echo "✅ DEER MES is running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000"
echo "   Login:    admin / admin123"
echo ""
echo "Press Ctrl+C to stop..."
wait
