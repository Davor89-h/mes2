#!/bin/bash
echo "🦌 Building DEER MES v6 for production..."
cd frontend && npm install && npm run build
cd ../backend && npm install
echo ""
echo "✅ Starting server on http://localhost:3000"
echo "   Login: admin / admin123"
npm start
