const axios = require('axios');

const TARGET_URL = process.env.TARGET_URL || 'http://localhost/api/registrations';
const profile = process.argv.includes('--profile') 
  ? process.argv[process.argv.indexOf('--profile') + 1] 
  : 'burst';

const durationSec = parseInt(process.env.DURATION || '30', 10);
let concurrency = 10;
let intervalMs = 20;

if (profile === 'cool') {
  concurrency = 1;
  intervalMs = 500;
  console.log(`[SurgeGen] Running COOL profile: 2 RPS for ${durationSec}s to test scale-down cooldown path...`);
} else if (profile === 'idempotency') {
  console.log(`[SurgeGen] Running IDEMPOTENCY test profile (10 identical requests)...`);
  runIdempotencyTest();
  return;
} else {
  console.log(`[SurgeGen] Running BURST profile: High Concurrency for ${durationSec}s to trigger scale-up...`);
}

let totalSent = 0;
let totalSuccess = 0;
let totalFailed = 0;
const startTime = Date.now();

async function sendBatch() {
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    totalSent++;
    const idempotencyKey = `idemp-${Math.floor(Math.random() * 1000000)}`;
    promises.push(
      axios.post(TARGET_URL, {
        eventId: 'evt-1',
        userId: `user-${Math.floor(Math.random() * 10000)}`
      }, {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
          'Content-Type': 'application/json'
        },
        timeout: 3000
      }).then(res => {
        if (res.status === 201 || res.status === 200) totalSuccess++;
        else totalFailed++;
      }).catch(() => {
        totalFailed++;
      })
    );
  }
  await Promise.all(promises);
}

const timer = setInterval(() => {
  sendBatch();
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
