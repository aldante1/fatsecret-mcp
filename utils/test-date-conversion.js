#!/usr/bin/env node

/**
 * Test the date conversion function
 */

function dateToFatSecretFormat(dateString) {
  const date = dateString ? new Date(dateString) : new Date();
  const epochStart = new Date('1970-01-01');
  const daysSinceEpoch = Math.floor((date.getTime() - epochStart.getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceEpoch.toString();
}

console.log('Testing date conversion to FatSecret format (days since epoch):\n');

// Test cases
const testDates = [
  '2025-07-07',
  '2024-01-01',
  '1970-01-01',
  '2023-12-31',
  null // Today's date
];

testDates.forEach(date => {
  const result = dateToFatSecretFormat(date);
  console.log(`${date || 'Today'} => ${result} days since epoch`);
});

// Calculate what today is
const today = new Date();
console.log(`\nToday's date: ${today.toISOString().split('T')[0]}`);