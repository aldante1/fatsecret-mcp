#!/bin/bash

# Generate secure MCP_AUTH_TOKEN for Railway deployment
echo "🔒 Generating secure MCP_AUTH_TOKEN..."
echo ""

# Method 1: Using OpenSSL (if available)
if command -v openssl &> /dev/null; then
    TOKEN=$(openssl rand -hex 32)
    echo "✅ Generated with OpenSSL:"
    echo "MCP_AUTH_TOKEN=$TOKEN"
    echo ""
fi

# Method 2: Using Node.js (if available)
if command -v node &> /dev/null; then
    TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "✅ Generated with Node.js:"
    echo "MCP_AUTH_TOKEN=$TOKEN"
    echo ""
fi

# Method 3: Using Python (if available)
if command -v python3 &> /dev/null; then
    TOKEN=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    echo "✅ Generated with Python3:"
    echo "MCP_AUTH_TOKEN=$TOKEN"
    echo ""
fi

echo "🚀 Railway deployment command:"
echo "railway variables set MCP_AUTH_TOKEN=$TOKEN"
echo ""
echo "📝 Copy this token to use in Poke as API Key"
