const axios = require('axios');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost/api/registrations';
const profile = process.argv.includes('--profile') 
  ? process.argv[process.argv.indexOf('--profile') + 1] 
  : 'burst';

const durationSec = parseInt(process.env.DURATION || '30', 10);
let rpsTarget = 150;

if (profile === 'cool') {
  rpsTarget = 2;
  console.log(`[SurgeGen] Running COOL profile: ${rpsTarget} RPS for ${durationSec}s to test scale-down cooldown path...`);
} else if (profile === 'idempotency') {
  console.log(`[SurgeGen] Running IDEMPOTENCY test profile (10 identical requests)...`);
  runIdempotencyTest();
  process.exit(0);
} else {
  console.log(`[SurgeGen] Running BURST profile: ${rpsTarget} RPS for ${durationSec}s to trigger scale-up...`);
}

let totalSent = 0;
let totalSuccess = 0;
let totalFailed = 0;
const startTime = Date.now();

async function sendRequest() {
  totalSent++;
  const idempotencyKey = `idemp-${Math.floor(Math.random() * 100000)}`;
  try {
    const res = await axios.post(TARGET_URL, {
      eventId: 'evt-1',
      userId: `user-${Math.floor(Math.random() * 5000)}`
    }, {
      headers: {
        'X-Idempotency-Key': idempotencyKey,
        'Content-Type': 'application/json'
      },
      timeout: 2000
    });

    if (res.status === 201 || res.status === 200) {
      totalSuccess++;
    } else {
      totalFailed++;
    }
  } catch (err) {
    totalFailed++;
  }
}

// Spawns interval ticker for targeted RPS
const intervalMs = 1000 / rpsTarget;
const timer = setInterval(() => {
  sendRequest();
  const elapsedSec = (Date.now() - startTime) / 1000;
  if (elapsedSec >= durationSec) {
    clearInterval(timer);
    setTimeout(() => {
      console.log(`\n================ Load Test Report ================`);
      console.log(`Profile:         ${profile}`);
      console.log(`Total Requests:  ${totalSent}`);
      console.log(`Success (2xx):   ${totalSuccess}`);
      console.log(`Failed (5xx/Err): ${totalFailed}`);
      console.log(`Elapsed Time:    ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      console.log(`==================================================\n`);
    }, 1000);
  }
}, intervalMs);

async function runIdempotencyTest() {
  const fixedKey = `idemp-test-fixed-uuid-12345`;
  console.log(`Sending 10 requests with identical key: ${fixedKey}...`);
  for (let i = 1; i <= 10; i++) {
    try {
      const res = await axios.post(TARGET_URL, { eventId: 'evt-1', userId: 'user-99' }, {
        headers: { 'X-Idempotency-Key': fixedKey }
      });
      console.log(`Req #${i}: Status ${res.status} | Res:`, JSON.stringify(res.data));
    } catch (err) {
      console.log(`Req #${i}: Failed ${err.message}`);
    }
  }
}
