#!/bin/bash

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Fingerprint Attendance System - Setup Verification        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js
echo "✓ Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "  ✓ Node.js installed: $NODE_VERSION"
else
    echo "  ✗ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check npm
echo ""
echo "✓ Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "  ✓ npm installed: $NPM_VERSION"
else
    echo "  ✗ npm not found"
    exit 1
fi

# Check MongoDB
echo ""
echo "✓ Checking MongoDB..."
if command -v mongod &> /dev/null; then
    echo "  ✓ MongoDB installed"
elif command -v mongo &> /dev/null; then
    echo "  ✓ MongoDB client installed"
else
    echo "  ⚠ MongoDB not found in PATH"
    echo "    MongoDB can be running elsewhere or via Docker"
fi

# Check .env file
echo ""
echo "✓ Checking .env file..."
if [ -f ".env" ]; then
    echo "  ✓ .env file exists"
else
    echo "  ⚠ .env file not found"
    echo "  Creating .env from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "  ✓ .env created from .env.example"
        echo "  ⚠ Please edit .env with your configuration"
    fi
fi

# Check node_modules
echo ""
echo "✓ Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "  ✓ node_modules directory found"
else
    echo "  ⚠ node_modules not found"
    echo "  Installing dependencies..."
    npm install
fi

# List key files
echo ""
echo "✓ Project structure:"
echo "  ✓ Controllers: $(ls controllers/*.js 2>/dev/null | wc -l) files"
echo "  ✓ Models: $(ls models/*.js 2>/dev/null | wc -l) files"
echo "  ✓ Services: $(ls services/*.js 2>/dev/null | wc -l) files"
echo "  ✓ Routes: $(ls routes/*.js 2>/dev/null | wc -l) files"
echo "  ✓ Views: $(find views -name '*.ejs' 2>/dev/null | wc -l) templates"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Setup Verification Complete!                              ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Next steps:                                               ║"
echo "║  1. Edit .env with your MongoDB URI and settings           ║"
echo "║  2. Start MongoDB server                                   ║"
echo "║  3. Run: npm run dev                                       ║"
echo "║  4. Open: http://localhost:3000                            ║"
echo "║  5. Register and login                                     ║"
echo "║                                                            ║"
echo "║  Documentation:                                            ║"
echo "║  - README.md: Overview and features                        ║"
echo "║  - API.md: Complete API reference                          ║"
echo "║  - DEPLOYMENT.md: Production deployment guide              ║"
echo "╚════════════════════════════════════════════════════════════╝"
