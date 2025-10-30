#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import crypto from "crypto";
import fetch from "node-fetch";
import querystring from "querystring";
import fs from "fs/promises";
import path from "path";
import os from "os";
import * as dotenv from "dotenv";
import { createServer } from "http";

// Suppress dotenv console output by temporarily overriding console.log
const originalLog = console.log;
console.log = () => {};
dotenv.config();
console.log = originalLog;

interface FatSecretConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  accessTokenSecret?: string;
  userId?: string;
}

interface OAuthToken {
  oauth_token: string;
  oauth_token_secret: string;
  oauth_callback_confirmed?: string;
}

interface AccessToken {
  oauth_token: string;
  oauth_token_secret: string;
  user_id?: string;
}

class FatSecretMCPServer {
  private server: Server;
  private config: FatSecretConfig;
  private configPath: string;
  private readonly baseUrl = "https://platform.fatsecret.com/rest/server.api";
  private readonly requestTokenUrl = "https://authentication.fatsecret.com/oauth/request_token";
  private readonly authorizeUrl = "https://authentication.fatsecret.com/oauth/authorize";
  private readonly accessTokenUrl = "https://authentication.fatsecret.com/oauth/access_token";

  constructor() {
    this.server = new Server(
      {
        name: "fatsecret-nutrition",
        version: "1.0.0",
        title: "FatSecret Nutrition",
        instructions: "Search foods and recipes for nutrition information. Use search_nutrition before get_nutrition_details for complete data. All dates in YYYY-MM-DD format. Rate limit: 100 requests/min. OAuth required for user data (food diary, profile). Nutrition values in standard units (calories, grams, mg)."
      }
    );

    this.configPath = path.join(os.homedir(), ".fatsecret-nutrition-config.json");
    this.config = {
      clientId: process.env.CLIENT_ID || "",
      clientSecret: process.env.CLIENT_SECRET || "",
    };

    this.setupToolHandlers();
  }

  private async loadConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, "utf-8");
      this.config = { ...this.config, ...JSON.parse(configData) };
    } catch (error) {
      // Config file doesn't exist, will be created when credentials are set
    }
  }

  private async saveConfig(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  private generateNonce(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  private generateTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }

  private dateToFatSecretFormat(dateString?: string): string {
    // Convert date to days since epoch (1970-01-01)
    // If no date provided, use today
    let date: Date;
    
    if (dateString) {
      // Validate date format YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateString)) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid date format: ${dateString}. Expected format: YYYY-MM-DD`
        );
      }
      
      date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Invalid date: ${dateString}`
        );
      }
    } else {
      date = new Date();
    }
    
    const epochStart = new Date('1970-01-01');
    const daysSinceEpoch = Math.floor((date.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceEpoch.toString();
  }

  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(
        /[!'()*]/g,
        (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
      );
  }

  private createSignatureBaseString(
    method: string,
    url: string,
    parameters: Record<string, string>,
  ): string {
    const sortedParams = Object.keys(parameters)
      .sort()
      .map((key) =>
        `${this.percentEncode(key)}=${this.percentEncode(parameters[key])}`
      )
      .join("&");

    return [
      method.toUpperCase(),
      this.percentEncode(url),
      this.percentEncode(sortedParams),
    ].join("&");
  }

  private createSigningKey(
    clientSecret: string,
    tokenSecret: string = "",
  ): string {
    return `${this.percentEncode(clientSecret)}&${
      this.percentEncode(tokenSecret)
    }`;
  }

  private generateSignature(
    method: string,
    url: string,
    parameters: Record<string, string>,
    clientSecret: string,
    tokenSecret: string = "",
  ): string {
    const baseString = this.createSignatureBaseString(method, url, parameters);
    const signingKey = this.createSigningKey(clientSecret, tokenSecret);

    return crypto
      .createHmac("sha1", signingKey)
      .update(baseString)
      .digest("base64");
  }

  private createOAuthHeader(
    method: string,
    url: string,
    additionalParams: Record<string, string> = {},
    token?: string,
    tokenSecret?: string,
    regularParams: Record<string, string> = {},
  ): string {
    const timestamp = this.generateTimestamp();
    const nonce = this.generateNonce();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.config.clientId,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_version: "1.0",
      ...additionalParams,
    };

    if (token) {
      oauthParams.oauth_token = token;
    }

    // For signature calculation, we need ALL parameters (OAuth + regular)
    const allParams = { ...oauthParams, ...regularParams };

    const signature = this.generateSignature(
      method,
      url,
      allParams,
      this.config.clientSecret,
      tokenSecret,
    );

    oauthParams.oauth_signature = signature;

    const headerParts = Object.keys(oauthParams)
      .sort()
      .map((key) =>
        `${this.percentEncode(key)}="${this.percentEncode(oauthParams[key])}"`
      )
      .join(", ");

    return `OAuth ${headerParts}`;
  }

  private async makeOAuthRequest(
    method: string,
    url: string,
    params: Record<string, string> = {},
    token?: string,
    tokenSecret?: string,
  ): Promise<any> {
    const timestamp = this.generateTimestamp();
    const nonce = this.generateNonce();

    // Build OAuth parameters
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.config.clientId,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_version: "1.0",
    };

    if (token) {
      oauthParams.oauth_token = token;
    }

    // Combine OAuth and regular parameters for signature
    const allParams = { ...params, ...oauthParams };

    // Generate signature with all parameters
    const signature = this.generateSignature(
      method,
      url,
      allParams,
      this.config.clientSecret,
      tokenSecret,
    );

    // Add signature to the parameters
    allParams.oauth_signature = signature;

    const options: any = {
      method,
      headers: {},
    };

    let requestUrl = url;
    if (method === "GET") {
      requestUrl += "?" + querystring.stringify(allParams);
    } else if (method === "POST") {
      options.headers["Content-Type"] = "application/x-www-form-urlencoded";
      options.body = querystring.stringify(allParams);
    }

    const response = await fetch(requestUrl, options);
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`OAuth error: ${response.status} - ${text}`);
    }

    // Try to parse as JSON, fallback to query string
    try {
      return JSON.parse(text);
    } catch {
      return querystring.parse(text);
    }
  }

  private async makeApiRequest(
    method: string,
    url: string,
    params: Record<string, string> = {},
    useAccessToken: boolean = true,
  ): Promise<any> {
    const timestamp = this.generateTimestamp();
    const nonce = this.generateNonce();

    // Build OAuth parameters
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.config.clientId,
      oauth_nonce: nonce,
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: timestamp,
      oauth_version: "1.0",
    };

    if (useAccessToken && this.config.accessToken && this.config.accessTokenSecret) {
      oauthParams.oauth_token = this.config.accessToken;
    }

    // Add format=json for API requests
    params.format = "json";

    // Combine OAuth and regular parameters for signature
    const allParams = { ...params, ...oauthParams };

    // Generate signature with all parameters
    const tokenSecret = useAccessToken ? this.config.accessTokenSecret : undefined;
    const signature = this.generateSignature(
      method,
      url,
      allParams,
      this.config.clientSecret,
      tokenSecret,
    );

    // Add signature to the parameters
    allParams.oauth_signature = signature;

    const options: any = {
      method,
      headers: {},
    };

    let requestUrl = url;
    if (method === "GET") {
      requestUrl += "?" + querystring.stringify(allParams);
    } else if (method === "POST") {
      options.headers["Content-Type"] = "application/x-www-form-urlencoded";
      options.body = querystring.stringify(allParams);
    }

    const response = await fetch(requestUrl, options);
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`FatSecret API error: ${response.status} - ${text}`);
    }

    // Try to parse as JSON, fallback to query string
    try {
      return JSON.parse(text);
    } catch {
      return querystring.parse(text);
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "search_nutrition",
            description: "Search for foods and recipes with nutrition information. Returns basic info for quick overview - use get_nutrition_details for complete nutritional data including vitamins, minerals, and serving sizes.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search term for food or recipe (e.g., 'chicken breast', 'banana', 'pasta carbonara')",
                },
                type: {
                  type: "string",
                  enum: ["all", "foods", "recipes"],
                  description: "Search type - include both foods and recipes, or limit to one type",
                  default: "all",
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results (default: 20)",
                  default: 20,
                  minimum: 1,
                  maximum: 50,
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_nutrition_details", 
            description: "Get complete nutritional information for a specific food or recipe including calories, macronutrients, vitamins, minerals, and all available serving sizes. Use search_nutrition first to find the food_id or recipe_id.",
            inputSchema: {
              type: "object",
              properties: {
                foodId: {
                  type: "string",
                  description: "FatSecret food ID (from search_nutrition results)",
                },
                recipeId: {
                  type: "string", 
                  description: "FatSecret recipe ID (from search_nutrition results)",
                },
              },
              required: [],
              anyOf: [
                { required: ["foodId"] },
                { required: ["recipeId"] }
              ],
            },
          },
          {
            name: "get_daily_nutrition",
            description: "Get complete daily nutrition summary including all food entries, total calories, macronutrients, and meal breakdown for a specific date. Requires OAuth authentication.",
            inputSchema: {
              type: "object",
              properties: {
                date: {
                  type: "string",
                  description: "Date in YYYY-MM-DD format (default: today)",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                },
              },
              required: [],
            },
          },
          {
            name: "add_food_to_diary",
            description: "Add a food item to your nutrition diary with specific serving size and meal type. Requires OAuth authentication. Use get_nutrition_details first to find serving_id.",
            inputSchema: {
              type: "object",
              properties: {
                foodId: {
                  type: "string",
                  description: "FatSecret food ID (from search_nutrition)",
                },
                servingId: {
                  type: "string",
                  description: "Serving ID for the food (from get_nutrition_details)",
                },
                quantity: {
                  type: "number",
                  description: "Number of servings (e.g., 1.5 for 1.5 servings)",
                  minimum: 0.1,
                  maximum: 100,
                },
                mealType: {
                  type: "string",
                  enum: ["breakfast", "lunch", "dinner", "snack"],
                  description: "Meal type for the food entry",
                },
                date: {
                  type: "string",
                  description: "Date in YYYY-MM-DD format (default: today)",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                },
              },
              required: ["foodId", "servingId", "quantity", "mealType"],
            },
          },
          {
            name: "get_user_profile",
            description: "Get user profile information including weight goal, activity level, and dietary preferences. Requires OAuth authentication.",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          {
            name: "authenticate_fatsecret",
            description: "Complete OAuth authentication with FatSecret. Provides authorization URL and handles token exchange. Required for diary operations and user data.",
            inputSchema: {
              type: "object",
              properties: {
                clientId: {
                  type: "string",
                  description: "Your FatSecret Client ID from platform.fatsecret.com",
                },
                clientSecret: {
                  type: "string",
                  description: "Your FatSecret Client Secret from platform.fatsecret.com",
                },
                verifier: {
                  type: "string",
                  description: "OAuth verifier code from authorization page (omit to start new flow)",
                },
                requestToken: {
                  type: "string",
                  description: "Request token from authorization step (provide with verifier)",
                },
                requestTokenSecret: {
                  type: "string",
                  description: "Request token secret from authorization step (provide with verifier)",
                },
              },
              required: ["clientId", "clientSecret"],
            },
          },
          {
            name: "check_authentication",
            description: "Check current authentication status with FatSecret. Shows if credentials are configured and if user is authenticated for diary operations.",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.loadConfig();

      switch (request.params.name) {
        case "search_nutrition":
          return await this.handleSearchNutrition(request.params.arguments);
        case "get_nutrition_details":
          return await this.handleGetNutritionDetails(request.params.arguments);
        case "get_daily_nutrition":
          return await this.handleGetDailyNutrition(request.params.arguments);
        case "add_food_to_diary":
          return await this.handleAddFoodToDiary(request.params.arguments);
        case "get_user_profile":
          return await this.handleGetUserProfile(request.params.arguments);
        case "authenticate_fatsecret":
          return await this.handleAuthenticateFatSecret(request.params.arguments);
        case "check_authentication":
          return await this.handleCheckAuthentication(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`,
          );
      }
    });
  }

  private async handleSearchNutrition(args: any) {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Please authenticate with FatSecret first using authenticate_fatsecret",
      );
    }

    // Validate search query
    if (!args.query || typeof args.query !== 'string' || args.query.trim().length === 0) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Search query is required and must be a non-empty string"
      );
    }

    // Validate limit
    const limit = args.limit ? parseInt(args.limit) : 20;
    if (isNaN(limit) || limit < 1 || limit > 50) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Limit must be a number between 1 and 50"
      );
    }

    try {
      if (args.type === "recipes") {
        // Search only recipes
        const params = {
          method: "recipes.search",
          search_expression: args.query.trim(),
          page_number: "0",
          max_results: limit.toString(),
          format: "json",
        };

        const response = await this.makeApiRequest("GET", this.baseUrl, params, false);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              type: "recipes",
              query: args.query.trim(),
              results: response
            }, null, 2)
          }]
        };
      } else {
        // Search foods (default)
        const params = {
          method: "foods.search",
          search_expression: args.query.trim(),
          page_number: "0",
          max_results: limit.toString(),
          format: "json",
        };

        const response = await this.makeApiRequest("GET", this.baseUrl, params, false);
        
        let result = {
          type: "foods",
          query: args.query.trim(),
          results: response
        };

        // If type is "all", also search recipes
        if (args.type === "all") {
          const recipeParams = {
            method: "recipes.search",
            search_expression: args.query.trim(),
            page_number: "0",
            max_results: Math.floor(limit / 2).toString(),
            format: "json",
          };

          const recipeResponse = await this.makeApiRequest("GET", this.baseUrl, recipeParams, false);
          result = {
            type: "all",
            query: args.query.trim(),
            results: {
              foods: response,
              recipes: recipeResponse
            }
          };
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to search nutrition: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleGetNutritionDetails(args: any) {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "Please authenticate with FatSecret first using authenticate_fatsecret",
      );
    }

    try {
      let response;
      let type;

      if (args.foodId) {
        const params = {
          method: "food.get",
          food_id: args.foodId,
          format: "json",
        };
        response = await this.makeApiRequest("GET", this.baseUrl, params, false);
        type = "food";
      } else if (args.recipeId) {
        const params = {
          method: "recipe.get",
          recipe_id: args.recipeId,
          format: "json",
        };
        response = await this.makeApiRequest("GET", this.baseUrl, params, false);
        type = "recipe";
      } else {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Either foodId or recipeId must be provided"
        );
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            type: type,
            details: response
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get nutrition details: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleGetDailyNutrition(args: any) {
    if (!this.config.accessToken || !this.config.accessTokenSecret) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "User authentication required. Please complete OAuth flow using authenticate_fatsecret first.",
      );
    }

    try {
      const date = this.dateToFatSecretFormat(args.date);
      const params = {
        method: "food_entries.get",
        date: date,
        format: "json",
      };

      const response = await this.makeApiRequest("GET", this.baseUrl, params, true);

      // Calculate daily totals
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;
      const meals: { [key: string]: any[] } = { breakfast: [], lunch: [], dinner: [], snack: [] };

      if (response.food_entries && response.food_entries.food_entry) {
        const entries = Array.isArray(response.food_entries.food_entry) 
          ? response.food_entries.food_entry 
          : [response.food_entries.food_entry];

        entries.forEach((entry: any) => {
          const calories = parseInt(entry.calories) || 0;
          const protein = parseFloat(entry.protein) || 0;
          const carbs = parseFloat(entry.carbohydrate) || 0;
          const fat = parseFloat(entry.fat) || 0;

          totalCalories += calories;
          totalProtein += protein;
          totalCarbs += carbs;
          totalFat += fat;

          const mealType: string = entry.meal || 'snack';
          if (mealType in meals) {
            meals[mealType as keyof typeof meals].push(entry);
          }
        });
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            date: args.date || "today",
            totals: {
              calories: totalCalories,
              protein: Math.round(totalProtein * 100) / 100,
              carbohydrates: Math.round(totalCarbs * 100) / 100,
              fat: Math.round(totalFat * 100) / 100
            },
            meals: meals,
            raw_entries: response
          }, null, 2)
        }]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get daily nutrition: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleAddFoodToDiary(args: any) {
    if (!this.config.accessToken || !this.config.accessTokenSecret) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "User authentication required. Please complete OAuth flow using authenticate_fatsecret first.",
      );
    }

    try {
      const date = this.dateToFatSecretFormat(args.date);
      const params = {
        method: "food_entry.create",
        food_id: args.foodId,
        serving_id: args.servingId,
        quantity: args.quantity.toString(),
        meal: args.mealType,
        date: date,
        format: "json",
      };

      const response = await this.makeApiRequest("POST", this.baseUrl, params, true);

      return {
        content: [{
          type: "text",
          text: `Food entry added successfully to ${args.mealType}!\n\n${JSON.stringify(response, null, 2)}`
        }]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add food to diary: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleAuthenticateFatSecret(args: any) {
    try {
      // If this is the start of OAuth flow
      if (!args.verifier || !args.requestToken || !args.requestTokenSecret) {
        // Set credentials
        this.config.clientId = args.clientId;
        this.config.clientSecret = args.clientSecret;
        await this.saveConfig();

        // Start OAuth flow
        const response = await this.makeOAuthRequest(
          "POST",
          this.requestTokenUrl,
          { oauth_callback: "oob" }
        );

        const authUrl = `${this.authorizeUrl}?oauth_token=${response.oauth_token}`;

        return {
          content: [{
            type: "text",
            text: `OAuth flow started! Please visit this URL to authorize:\n\n${authUrl}\n\nAfter authorization, copy the verifier code and call authenticate_fatsecret again with:\n- verifier: [code from authorization page]\n- requestToken: ${response.oauth_token}\n- requestTokenSecret: ${response.oauth_token_secret}\n- clientId: ${args.clientId}\n- clientSecret: ${args.clientSecret}`
          }]
        };
      } else {
        // Complete OAuth flow
        this.config.clientId = args.clientId;
        this.config.clientSecret = args.clientSecret;

        const response = await this.makeOAuthRequest(
          "GET",
          this.accessTokenUrl,
          { oauth_verifier: args.verifier },
          args.requestToken,
          args.requestTokenSecret
        );

        this.config.accessToken = response.oauth_token;
        this.config.accessTokenSecret = response.oauth_token_secret;
        this.config.userId = response.user_id;

        await this.saveConfig();

        return {
          content: [{
            type: "text",
            text: `Authentication successful! You are now connected to FatSecret.\n\nUser ID: ${this.config.userId}\n\nYou can now use diary operations like get_daily_nutrition and add_food_to_diary.`
          }]
        };
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleGetUserProfile(args: any) {
    if (!this.config.accessToken || !this.config.accessTokenSecret) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        "User authentication required. Please complete OAuth flow using authenticate_fatsecret first.",
      );
    }

    try {
      const params = {
        method: "profile.get",
        format: "json",
      };

      const response = await this.makeApiRequest("GET", this.baseUrl, params, true);

      return {
        content: [{
          type: "text",
          text: JSON.stringify(response, null, 2)
        }]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get user profile: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async handleCheckAuthentication(args: any) {
    const hasCredentials = !!(this.config.clientId && this.config.clientSecret);
    const hasAccessToken = !!(this.config.accessToken && this.config.accessTokenSecret);

    let status = "Not configured";
    if (hasCredentials && hasAccessToken) {
      status = "Fully authenticated";
    } else if (hasCredentials) {
      status = "Credentials set, user authentication needed";
    }

    return {
      content: [{
        type: "text",
        text: `Authentication Status: ${status}\n\n✓ API Credentials configured: ${hasCredentials}\n✓ User authenticated: ${hasAccessToken}\n📱 User ID: ${this.config.userId || "N/A"}\n\n${!hasCredentials ? "Next: Call authenticate_fatsecret with your Client ID and Secret" : ""}${hasCredentials && !hasAccessToken ? "\nNext: Complete OAuth flow by calling authenticate_fatsecret and following the authorization URL" : ""}${hasCredentials && hasAccessToken ? "\nReady to use all nutrition tracking features!" : ""}`
      }]
    };
  }

  async runStdio() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("FatSecret MCP server running on stdio");
  }

  async runSSE(port: number = 3000) {
    const server = createServer(async (req, res) => {
      // Enable CORS for all requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');

      // Handle OPTIONS preflight requests
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          auth_required: !!process.env.MCP_AUTH_TOKEN
        }));
        return;
      }

      // HTTP POST endpoint for Poke (Streamable HTTP)
      if (req.url === '/mcp' && req.method === 'POST') {
        try {
          // Check MCP_AUTH_TOKEN if configured
          const authToken = process.env.MCP_AUTH_TOKEN;
          if (authToken) {
            const providedToken = req.headers.authorization?.replace('Bearer ', '');
            if (providedToken !== authToken) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                jsonrpc: "2.0",
                error: {
                  code: -32001,
                  message: "Unauthorized"
                }
              }));
              return;
            }
          }

          // Read request body
          const body = await new Promise<string>((resolve, reject) => {
            let data = '';
            req.on('data', chunk => data += chunk);
            req.on('end', () => resolve(data));
            req.on('error', reject);
          });

          const message = JSON.parse(body.toString());
          
          // Handle MCP request according to Poke specification
          let response;
          
          if (message.method === 'initialize') {
            response = {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                protocolVersion: "2024-11-05",
                capabilities: {
                  tools: {}
                },
                serverInfo: {
                  name: "FatSecret Nutrition",
                  version: "1.0.0"
                }
              }
            };
          } else if (message.method === 'tools/list') {
            response = {
              jsonrpc: "2.0", 
              id: message.id,
              result: {
                tools: [
                  {
                    name: "search_nutrition",
                    description: "Search for foods and recipes by query",
                    inputSchema: {
                      type: "object",
                      properties: {
                        query: { 
                          type: "string", 
                          description: "Search query for foods or recipes" 
                        }
                      },
                      required: ["query"]
                    }
                  },
                  {
                    name: "get_nutrition_details",
                    description: "Get detailed nutrition information for a specific food",
                    inputSchema: {
                      type: "object",
                      properties: {
                        food_id: { 
                          type: "string", 
                          description: "FatSecret food ID" 
                        }
                      },
                      required: ["food_id"]
                    }
                  }
                ]
              }
            };
          } else if (message.method === 'tools/call') {
            // Handle tool calls (basic implementation)
            const { name, arguments: args } = message.params;
            response = {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `Tool ${name} called with args: ${JSON.stringify(args)}. This is a placeholder response.`
                  }
                ]
              }
            };
          } else {
            response = {
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32601,
                message: "Method not found"
              }
            };
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          return;
        } catch (error) {
          console.error('MCP request error:', error);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          }));
          return;
        }
      }

      // SSE endpoint with auth
      if (req.url === '/sse') {
        // Check MCP_AUTH_TOKEN if configured
        const authToken = process.env.MCP_AUTH_TOKEN;
        if (authToken) {
          const providedToken = req.headers.authorization?.replace('Bearer ', '');
          if (providedToken !== authToken) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: 'Unauthorized',
              message: 'Valid MCP_AUTH_TOKEN required'
            }));
            return;
          }
        }

        const transport = new SSEServerTransport('/message', res);
        await this.server.connect(transport);
        return;
      }

      // Root endpoint with server info
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: 'FatSecret Nutrition MCP',
          version: '1.0.0',
          status: 'running',
          endpoints: {
            health: '/health',
            sse: '/sse',
            mcp: '/mcp (POST)',
            info: '/'
          },
          auth_required: !!process.env.MCP_AUTH_TOKEN,
          timestamp: new Date().toISOString()
        }));
        return;
      }

      // 404 for other endpoints
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Not Found',
        message: 'Available endpoints: /, /health, /sse, /mcp (POST)'
      }));
    });

    server.listen(port, () => {
      console.log(`FatSecret MCP server running on http://localhost:${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`SSE endpoint: http://localhost:${port}/sse`);
      if (process.env.MCP_AUTH_TOKEN) {
        console.log(`🔒 Authentication enabled - MCP_AUTH_TOKEN required`);
      }
    });
  }
}

// Check if running in Railway/web environment
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
const port = parseInt(process.env.PORT || '3000');

if (isRailway) {
  // Run as HTTP server for Railway
  const server = new FatSecretMCPServer();
  server.runSSE(port).catch(console.error);
} else {
  // Run as stdio server for local development
  const server = new FatSecretMCPServer();
  server.runStdio().catch(console.error);
}
