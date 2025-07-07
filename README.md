# FatSecret MCP Server

A Model Context Protocol (MCP) server that provides access to the FatSecret nutrition database API with full 3-Legged OAuth authentication support.

## Features

- **Complete OAuth 1.0a Implementation**: Full 3-legged OAuth flow for user authentication
- **Food Database Access**: Search and retrieve detailed nutrition information
- **Recipe Database**: Search for recipes and get detailed cooking instructions
- **User Data Management**: Access user food diaries and add food entries
- **Secure Credential Storage**: Encrypted storage of API credentials and tokens

## Installation

```bash
# Clone or download the server files
npm install

# Build the TypeScript
npm run build
```

## Setup

### 1. Get FatSecret API Credentials

1. Visit the [FatSecret Platform](https://platform.fatsecret.com/)
2. Create a developer account and register your application
3. Note down your **Client ID** and **Client Secret**

### 2. Configure the MCP Server

The server needs to be configured in your MCP client (like Claude Desktop). Add this to your MCP configuration:

```json
{
  "mcpServers": {
    "fatsecret": {
      "command": "node",
      "args": ["path/to/fatsecret-mcp-server/dist/index.js"]
    }
  }
}
```

## Usage

### 1. Set API Credentials

First, set your FatSecret API credentials:

```
Use the set_credentials tool with your Client ID and Client Secret
```

### 2. Authenticate a User (3-Legged OAuth)

For user-specific operations, you need to complete the OAuth flow:

```
1. Use start_oauth_flow tool (with callback URL or "oob" for out-of-band)
2. Visit the provided authorization URL
3. Authorize the application and get the verifier code
4. Use complete_oauth_flow tool with the request token, secret, and verifier
```

### 3. Use the API

Once authenticated, you can use all available tools:

#### Food Search and Information

- `search_foods`: Search for foods in the database
- `get_food`: Get detailed nutrition information for a specific food

#### Recipe Search and Information

- `search_recipes`: Search for recipes
- `get_recipe`: Get detailed recipe information including ingredients and instructions

#### User Data (Requires Authentication)

- `get_user_profile`: Get the authenticated user's profile
- `get_user_food_entries`: Get food diary entries for a specific date
- `add_food_entry`: Add a food entry to the user's diary

#### Utility

- `check_auth_status`: Check current authentication status

## Available Tools

### Authentication Tools

#### `set_credentials`

Set your FatSecret API credentials.

**Parameters:**

- `clientId` (string, required): Your FatSecret Client ID
- `clientSecret` (string, required): Your FatSecret Client Secret

#### `start_oauth_flow`

Start the 3-legged OAuth flow.

**Parameters:**

- `callbackUrl` (string, optional): OAuth callback URL (default: "oob")

#### `complete_oauth_flow`

Complete the OAuth flow with authorization.

**Parameters:**

- `requestToken` (string, required): Request token from start_oauth_flow
- `requestTokenSecret` (string, required): Request token secret from start_oauth_flow
- `verifier` (string, required): OAuth verifier from authorization

#### `check_auth_status`

Check current authentication status.

### Food Database Tools

#### `search_foods`

Search for foods in the FatSecret database.

**Parameters:**

- `searchExpression` (string, required): Search term
- `pageNumber` (number, optional): Page number (default: 0)
- `maxResults` (number, optional): Max results per page (default: 20)

#### `get_food`

Get detailed information about a specific food.

**Parameters:**

- `foodId` (string, required): FatSecret food ID

### Recipe Database Tools

#### `search_recipes`

Search for recipes in the FatSecret database.

**Parameters:**

- `searchExpression` (string, required): Search term
- `pageNumber` (number, optional): Page number (default: 0)
- `maxResults` (number, optional): Max results per page (default: 20)

#### `get_recipe`

Get detailed information about a specific recipe.

**Parameters:**

- `recipeId` (string, required): FatSecret recipe ID

### User Data Tools (Requires Authentication)

#### `get_user_profile`

Get the authenticated user's profile information.

#### `get_user_food_entries`

Get user's food diary entries for a specific date.

**Parameters:**

- `date` (string, optional): Date in YYYY-MM-DD format (default: today)

#### `add_food_entry`

Add a food entry to the user's diary.

**Parameters:**

- `foodId` (string, required): FatSecret food ID
- `servingId` (string, required): Serving ID for the food
- `quantity` (number, required): Quantity of the serving
- `mealType` (string, required): Meal type (breakfast, lunch, dinner, snack)
- `date` (string, optional): Date in YYYY-MM-DD format (default: today)

## Example Workflow

1. **Setup Credentials:**

   ```
   Tool: set_credentials
   - clientId: "your_client_id"
   - clientSecret: "your_client_secret"
   ```

2. **Search for Foods:**

   ```
   Tool: search_foods
   - searchExpression: "chicken breast"
   ```

3. **Get Food Details:**

   ```
   Tool: get_food
   - foodId: "12345"
   ```

4. **Authenticate User (if needed):**

   ```
   Tool: start_oauth_flow
   - callbackUrl: "oob"

   # Follow the authorization URL, then:

   Tool: complete_oauth_flow
   - requestToken: "from_start_oauth_flow"
   - requestTokenSecret: "from_start_oauth_flow"
   - verifier: "from_authorization_page"
   ```

5. **Add Food to Diary:**
   ```
   Tool: add_food_entry
   - foodId: "12345"
   - servingId: "67890"
   - quantity: 1
   - mealType: "lunch"
   ```

## Configuration Storage

The server stores configuration (credentials and tokens) in `~/.fatsecret-mcp-config.json`. This file contains:

- API credentials (Client ID and Secret)
- OAuth access tokens (when authenticated)
- User ID (when authenticated)

## Security Notes

- Credentials are stored locally in your home directory
- OAuth tokens are securely managed using proper HMAC-SHA1 signing
- All API communications use HTTPS
- The server implements proper OAuth 1.0a security measures

## API Reference

This server implements the FatSecret Platform API. For detailed API documentation, visit:

- [FatSecret Platform API Documentation](https://platform.fatsecret.com/docs/guides)
- [OAuth 1.0a Specification](https://tools.ietf.org/html/rfc5849)

## Error Handling

The server provides detailed error messages for common issues:

- Missing or invalid credentials
- OAuth flow errors
- API rate limiting
- Network connectivity issues
- Invalid parameters

## Development

To modify or extend the server:

```bash
# Install dependencies
npm install

# Build and run
npm run build
npm start

# Development mode with auto-rebuild
npm run dev
```

## License

MIT License - see LICENSE file for details.
