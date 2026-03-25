const axios = require('axios');
const WebSocket = require('ws');
const fs = require('fs');

const API_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001/stream';
const TEST_EMAIL = 'admin@example.com';
const TEST_PASSWORD = 'Password123!'; // Adjust if needed
const CONCURRENT_USERS = 20;

let token = '';

async function login() {
  console.log(`[LoadTest] Logging in as ${TEST_EMAIL}...`);
  try {
    const res = await axios.post(`${API_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    token = res.data.data.accessToken;
    console.log(`[LoadTest] Login successful. Got token.`);
  } catch (err) {
    if (err.response && err.response.status === 401) {
      console.log(`[LoadTest] User not found or invalid pass. Attempting to register ${TEST_EMAIL}...`);
      try {
        const regRes = await axios.post(`${API_URL}/auth/register`, {
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          role: 'user' 
        });
        token = regRes.data.data.accessToken;
        console.log(`[LoadTest] Registration successful. Got token.`);
      } catch (regErr) {
        console.error(`[LoadTest] Auto-registration failed: ${regErr.response?.data?.error || regErr.message}`);
        process.exit(1);
      }
    } else {
      console.error(`[LoadTest] Login failed: ${err.message}`);
      process.exit(1);
    }
  }
}

async function startStream(id) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    let chunksProcessed = 0;
    
    ws.on('open', () => {
      console.log(`[Stream ${id}] Connected`);
      // Send a dummy log payload (100 lines)
      const logs = Array(100).fill().map((_, i) => `[${new Date().toISOString()}] WARN User activity ${i} detected. Possible attempt to access /admin/routes`).join('\\n');
      ws.send(JSON.stringify({ type: 'stream_log', content: logs, sessionId: `test-session-${id}` }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.type === 'stream_progress') chunksProcessed++;
      if (msg.type === 'stream_complete') {
        console.log(`[Stream ${id}] Completed successfully! Processed ${chunksProcessed} chunks.`);
        ws.close();
        resolve(true);
      }
      if (msg.type === 'error' || msg.type === 'chunk_error') {
        console.error(`[Stream ${id}] Error: ${msg.message}`);
        resolve(false);
      }
    });

    ws.on('error', (err) => {
      console.error(`[Stream ${id}] WS Error:`, err.message);
      resolve(false);
    });
  });
}

async function bombardAnalytics() {
  let successes = 0;
  let failures = 0;
  console.log(`[LoadTest] Bombarding /admin/analytics (100 requests) to test caching...`);
  const promises = Array(100).fill().map(async () => {
    try {
      await axios.get(`${API_URL}/admin/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      successes++;
    } catch {
      failures++;
    }
  });
  
  const start = Date.now();
  await Promise.all(promises);
  console.log(`[LoadTest] Analytics complete in ${Date.now() - start}ms. Success: ${successes}, Fail: ${failures}`);
}

async function runTest() {
  await login();
  
  console.log(`[LoadTest] Spawning ${CONCURRENT_USERS} concurrent WebSocket streams...`);
  const start = Date.now();
  
  // Fire WS streams
  const wsPromises = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    wsPromises.push(startStream(i));
  }
  
  // Fire analytics burst at the exact same time
  await bombardAnalytics();
  
  const results = await Promise.all(wsPromises);
  const successCount = results.filter(r => r).length;
  
  console.log('\\n--- LOAD TEST RESULTS ---');
  console.log(`Total Time: ${Date.now() - start}ms`);
  console.log(`Concurrent Streams: ${CONCURRENT_USERS}`);
  console.log(`Successful Streams: ${successCount} / ${CONCURRENT_USERS}`);
  if (successCount === CONCURRENT_USERS) {
    console.log('✅ PASS: Stream clustering and queue management succeeded under load.');
  } else {
    console.log('❌ FAIL: Some streams disconnected or failed.');
  }
}

runTest();
