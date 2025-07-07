#!/usr/bin/env node

/**
 * Interactive test script for FatSecret MCP Server
 * 
 * This provides an interactive way to test the MCP server
 * Usage: node test-interactive.js
 */

const { spawn } = require('child_process');
const readline = require('readline');

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

let messageId = 1;

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Handle server output
server.stdout.on('data', (data) => {
  try {
    const response = JSON.parse(data.toString());
    console.log('\n📥 Response:', JSON.stringify(response, null, 2));
  } catch (e) {
    console.log('\n📥 Raw output:', data.toString());
  }
});

// Send a JSON-RPC message to the server
function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: "2.0",
    method: method,
    params: params,
    id: messageId++
  };
  
  console.log('\n📤 Sending:', JSON.stringify(message, null, 2));
  server.stdin.write(JSON.stringify(message) + '\n');
}

// Tool call helper
function callTool(name, args = {}) {
  sendMessage('tools/call', {
    name: name,
    arguments: args
  });
}

// Menu
function showMenu() {
  console.log('\n=== FatSecret MCP Server Test Menu ===');
  console.log('1. Initialize connection');
  console.log('2. List available tools');
  console.log('3. Check auth status');
  console.log('4. Search foods');
  console.log('5. Get food details');
  console.log('6. Get user food entries (requires auth)');
  console.log('7. Add food entry (requires auth)');
  console.log('8. Custom tool call');
  console.log('0. Exit');
  console.log('=====================================\n');
  
  rl.question('Choose an option: ', handleMenuChoice);
}

function handleMenuChoice(choice) {
  switch(choice) {
    case '1':
      sendMessage('initialize', {
        protocolVersion: "0.1.0",
        capabilities: {}
      });
      setTimeout(showMenu, 1000);
      break;
      
    case '2':
      sendMessage('tools/list');
      setTimeout(showMenu, 1000);
      break;
      
    case '3':
      callTool('check_auth_status');
      setTimeout(showMenu, 1000);
      break;
      
    case '4':
      rl.question('Search term: ', (term) => {
        callTool('search_foods', {
          searchExpression: term,
          maxResults: 5
        });
        setTimeout(showMenu, 1000);
      });
      break;
      
    case '5':
      rl.question('Food ID: ', (id) => {
        callTool('get_food', {
          foodId: id
        });
        setTimeout(showMenu, 1000);
      });
      break;
      
    case '6':
      rl.question('Date (YYYY-MM-DD, or press Enter for today): ', (date) => {
        const args = date ? { date } : {};
        callTool('get_user_food_entries', args);
        setTimeout(showMenu, 1000);
      });
      break;
      
    case '7':
      console.log('Add food entry:');
      rl.question('Food ID: ', (foodId) => {
        rl.question('Serving ID: ', (servingId) => {
          rl.question('Quantity: ', (quantity) => {
            rl.question('Meal type (breakfast/lunch/dinner/snack): ', (meal) => {
              rl.question('Date (YYYY-MM-DD, or press Enter for today): ', (date) => {
                const args = {
                  foodId,
                  servingId,
                  quantity: parseFloat(quantity),
                  mealType: meal
                };
                if (date) args.date = date;
                callTool('add_food_entry', args);
                setTimeout(showMenu, 1000);
              });
            });
          });
        });
      });
      break;
      
    case '8':
      rl.question('Tool name: ', (name) => {
        rl.question('Arguments (JSON): ', (argsStr) => {
          try {
            const args = argsStr ? JSON.parse(argsStr) : {};
            callTool(name, args);
          } catch (e) {
            console.error('Invalid JSON:', e.message);
          }
          setTimeout(showMenu, 1000);
        });
      });
      break;
      
    case '0':
      console.log('Exiting...');
      server.kill();
      process.exit(0);
      break;
      
    default:
      console.log('Invalid option');
      showMenu();
  }
}

// Start by initializing
console.log('Starting FatSecret MCP Server test...\n');
sendMessage('initialize', {
  protocolVersion: "0.1.0",
  capabilities: {}
});

// Show menu after initialization
setTimeout(showMenu, 1000);