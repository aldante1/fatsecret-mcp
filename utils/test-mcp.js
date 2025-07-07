#!/usr/bin/env node

/**
 * Test script for FatSecret MCP Server
 * 
 * This script simulates the JSON-RPC messages that Claude would send to test the MCP server.
 * Usage: node test-mcp.js | node dist/index.js
 */

// Test 1: Initialize connection
console.log(JSON.stringify({
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    protocolVersion: "0.1.0",
    capabilities: {}
  },
  id: 1
}));

// Test 2: List available tools
console.log(JSON.stringify({
  jsonrpc: "2.0",
  method: "tools/list",
  params: {},
  id: 2
}));

// Test 3: Check authentication status
console.log(JSON.stringify({
  jsonrpc: "2.0",
  method: "tools/call",
  params: {
    name: "check_auth_status",
    arguments: {}
  },
  id: 3
}));

// Test 4: Search for foods (doesn't require auth)
console.log(JSON.stringify({
  jsonrpc: "2.0",
  method: "tools/call",
  params: {
    name: "search_foods",
    arguments: {
      searchExpression: "apple",
      maxResults: 5
    }
  },
  id: 4
}));

// Test 5: Get user food entries for today (requires auth)
console.log(JSON.stringify({
  jsonrpc: "2.0",
  method: "tools/call",
  params: {
    name: "get_user_food_entries",
    arguments: {
      date: "2025-07-07"
    }
  },
  id: 5
}));

// Test 6: Get user food entries without date (should use today)
console.log(JSON.stringify({
  jsonrpc: "2.0",
  method: "tools/call",
  params: {
    name: "get_user_food_entries",
    arguments: {}
  },
  id: 6
}));