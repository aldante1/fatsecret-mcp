# FatSecret Nutrition MCP Server

A Model Context Protocol (MCP) server optimized for **Poke** that provides user-centric access to the FatSecret nutrition database with intelligent tool design and comprehensive OAuth authentication.

## ✨ Poke-Optimized Features

- **User-Centric Tool Design**: Tools designed around user intentions, not API structure
- **Intelligent Data Combination**: `get_daily_nutrition` provides complete daily summaries with calculated totals
- **Unified Search**: `search_nutrition` combines foods and recipes in one intelligent search
- **Streamlined Authentication**: Single `authenticate_fatsecret` tool handles the complete OAuth flow
- **Poke-Compliant Metadata**: Proper server instructions under 1000 characters
- **Rich JSON Schemas**: Comprehensive input validation and descriptions

## 🚀 Quick Start for Poke

### 1. Add to Poke

In **Settings → Integrations**, add your MCP server URL:
```
https://your-app.railway.app/mcp
```

**API Key (if configured):** Your `MCP_AUTH_TOKEN` value

**Alternative URLs:**
- SSE endpoint: `https://your-app.railway.app/sse`
- Health check: `https://your-app.railway.app/health`
- Server info: `https://your-app.railway.app/`

**Note:** Try `/mcp` first (HTTP POST), if issues persist use `/sse` (Server-Sent Events)

### 2. Get FatSecret API Credentials

1. Visit [FatSecret Platform](https://platform.fatsecret.com/)
2. Create a developer account and register your application
3. Note your **Client ID** and **Client Secret**

### 3. Deploy Options

#### Option A: Railway (Recommended)
```bash
# Configure environment variables in Railway dashboard:
# CLIENT_ID=your_fatsecret_client_id
# CLIENT_SECRET=your_fatsecret_client_secret
# NODE_ENV=production
# MCP_AUTH_TOKEN=your_secure_token

# Deploy to Railway (use Railway dashboard or git push)
git add .
git commit -m "Deploy to Railway"
git push origin main
```
📖 **Full guide:** [RAILWAY.md](./RAILWAY.md)

**Required Environment Variables:**
- `CLIENT_ID`: FatSecret API Client ID
- `CLIENT_SECRET`: FatSecret API Client Secret  
- `NODE_ENV`: `production`

**Security (Recommended):**
- `MCP_AUTH_TOKEN`: Secure token for Poke integration

**Poke Integration URL:**
```
https://your-app.railway.app/sse
```
Set `MCP_AUTH_TOKEN` as **API Key** in Poke settings.

#### Option B: Local Development
```bash
# Build and run locally
npm run build
npm run dev:stdio
```

### 4. Authenticate

Use the `authenticate_fatsecret` tool with your credentials:
- Provides authorization URL
- Handles complete OAuth flow
- Stores tokens securely for future use

## 🛠️ Available Tools

### 🔍 **search_nutrition**
Search for foods and recipes with intelligent filtering.
- **Use when**: "What's the nutrition info for chicken?" or "Find pasta recipes"
- **Returns**: Basic overview with food_id/recipe_id for detailed lookup
- **Parameters**: `query`, `type` (all/foods/recipes), `limit`

### 📊 **get_nutrition_details** 
Get complete nutritional information including vitamins, minerals, and serving sizes.
- **Use when**: "Show me detailed nutrition for this food" or "What are all the serving sizes?"
- **Requires**: food_id or recipe_id from search_nutrition
- **Returns**: Complete nutritional breakdown

### 📅 **get_daily_nutrition**
Get comprehensive daily nutrition summary with calculated totals and meal breakdown.
- **Use when**: "What did I eat today?" or "Show my nutrition summary"
- **Returns**: Total calories, macros, meal organization, raw entries
- **Requires**: OAuth authentication

### ➕ **add_food_to_diary**
Add food items to your nutrition diary with specific servings and meal types.
- **Use when**: "Add chicken to my lunch" or "Log this snack"
- **Requires**: food_id, serving_id, quantity, meal_type
- **Note**: Use get_nutrition_details first to find serving_id

### 👤 **get_user_profile**
Get user profile including weight goals and dietary preferences.
- **Use when**: "What's my profile?" or "Show my goals"
- **Requires**: OAuth authentication

### 🔐 **authenticate_fatsecret**
Complete OAuth authentication with FatSecret.
- **Use when**: Initial setup or re-authentication
- **Handles**: Full OAuth flow, token storage, user ID retrieval

### ✅ **check_authentication**
Check current authentication status.
- **Use when**: "Am I logged in?" or troubleshooting
- **Returns**: Clear status with next steps

## 🎯 Design Philosophy (Poke-Optimized)

### User Intent Focus
- **Before**: `search_foods` + `get_food` + `search_recipes` + `get_recipe`
- **After**: `search_nutrition` + `get_nutrition_details`

### Data Combination
- **Before**: Raw API responses requiring manual calculation
- **After**: `get_daily_nutrition` with pre-calculated totals and meal organization

### Streamlined Workflows
- **Before**: Multiple tools for authentication steps
- **After**: Single `authenticate_fatsecret` with stateful flow

### Intelligent Defaults
- Search limits with sensible defaults
- Flexible date handling (today or specific date)
- Clear error messages with next steps

## 📋 Server Instructions

```
Search foods and recipes for nutrition information. Use search_nutrition before get_nutrition_details for complete data. All dates in YYYY-MM-DD format. Rate limit: 100 requests/min. OAuth required for user data (food diary, profile). Nutrition values in standard units (calories, grams, mg).
```

## 🔧 Technical Specifications

### Protocol Support
- **Transport**: HTTPS with Streamable HTTP (primary) + SSE fallback
- **Authentication**: OAuth 1.0a with secure token storage
- **Rate Limits**: 100 requests/minute with intelligent batching

### Server Metadata
```json
{
  "name": "fatsecret-nutrition",
  "version": "1.0.0", 
  "title": "FatSecret Nutrition",
  "instructions": "Search foods and recipes for nutrition information. Use search_nutrition before get_nutrition_details for complete data. All dates in YYYY-MM-DD format. Rate limit: 100 requests/min. OAuth required for user data (food diary, profile). Nutrition values in standard units (calories, grams, mg)."
}
```

### Security
- Credentials stored in `~/.fatsecret-nutrition-config.json`
- HMAC-SHA1 signature generation
- HTTPS-only communications
- Secure OAuth 1.0a implementation
- **MCP_AUTH_TOKEN** protection for production deployments
- Bearer token authentication for Poke integration

## 🏗️ Development

```bash
# Install dependencies
npm install

# Build and run (Railway mode)
npm run build
npm start

# Local stdio development
npm run dev:stdio

# Clean build artifacts
npm run clean
```

## 📁 Project Structure

```
fatsecret-nutrition-mcp/
├── src/
│   ├── index.ts        # Main MCP server with Poke-optimized tools
│   ├── server.ts       # Railway-compatible HTTP server
│   └── cli.ts          # OAuth console utility
├── dist/               # Compiled JavaScript
├── utils/              # Test utilities
├── railway.json        # Railway configuration
├── railway.toml        # Railway TOML configuration
├── .env.railway        # Railway environment template
├── RAILWAY.md          # Railway deployment guide
├── package.json
├── tsconfig.json
└── README.md
```

## 🧪 Testing

### Interactive Testing
```bash
node utils/test-interactive.js
```

### Direct MCP Testing
```bash
node utils/test-mcp.js | node dist/index.js
```

## 🤝 Contributing

When contributing tools for Poke compatibility:

1. **User Intent First**: Design around what users want to accomplish
2. **Combine Related Data**: One tool call should answer complete questions
3. **Flexible Parameters**: Allow different use cases with sensible defaults
4. **Clear Descriptions**: Explain when to use each tool and what it returns
5. **Proper JSON Schemas**: Complete validation with helpful descriptions

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Links

- [FatSecret Platform API](https://platform.fatsecret.com/docs/guides)
- [Poke MCP Documentation](https://poke.com/docs/mcp-guide)
- [MCP Specification](https://modelcontextprotocol.io/specification)
