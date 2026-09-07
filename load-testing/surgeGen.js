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

const BASE_API = TARGET_URL.split('/api')[0] + '/api';

async function resetSeatsBeforeTest() {
  try {
    await axios.post(`${TARGET_URL}/reset`);
    console.log(`[SurgeGen] Successfully reset Event 1 seats to 'available'.`);
  } catch (err) {
    try {
      await axios.post(`${BASE_API}/events/1/reset`);
      console.log(`[SurgeGen] Successfully reset Event 1 seats to 'available'.`);
    } catch (e2) {
      console.log(`[SurgeGen] Reset seats note: ${err.message}`);
    }
  }
}

resetSeatsBeforeTest();

let totalSent = 0;
let totalSuccess = 0;
let totalConflicts = 0;
let totalTimeouts = 0;
let totalServerError = 0;
let totalOtherFailed = 0;
let sample5xxError = null;
const startTime = Date.now();

async function sendBatch() {
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    totalSent++;
    const idempotencyKey = `idemp-${Math.floor(Math.random() * 1000000)}`;
    promises.push(
      axios.post(TARGET_URL, {
        eventId: 1,
        userId: `user-${Math.floor(Math.random() * 10000)}`
      }, {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      }).then(res => {
        if (res.status === 201 || res.status === 200) totalSuccess++;
        else totalOtherFailed++;
      }).catch(err => {
        if (err.response && err.response.status === 409) {
          totalConflicts++;
        } else if (err.code === 'ECONNABORTED') {
          totalTimeouts++;
        } else if (err.response && err.response.status >= 500) {
          totalServerError++;
          if (!sample5xxError && err.response.data) {
            sample5xxError = JSON.stringify(err.response.data);
          }
        } else {
          totalOtherFailed++;
          if (!sample5xxError && err.message) {
            sample5xxError = err.message;
          }
        }
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
      console.log(`Profile:             ${profile}`);
      console.log(`Total Requests:      ${totalSent}`);
      console.log(`Success (201/200):   ${totalSuccess}`);
      console.log(`Seat Conflicts(409): ${totalConflicts}`);
      console.log(`Timeouts (5s limit): ${totalTimeouts}`);
      console.log(`Server Errors (5xx): ${totalServerError}`);
      if (sample5xxError) {
        console.log(`Sample 5xx Error:    ${sample5xxError}`);
      }
      console.log(`Other Failures:      ${totalOtherFailed}`);
      console.log(`Elapsed Time:        ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
      console.log(`==================================================\n`);
    }, 1000);
  }
}, intervalMs);

async function runIdempotencyTest() {
  const fixedKey = `idemp-test-fixed-uuid-12345`;
  console.log(`Sending 10 requests with identical key: ${fixedKey}...`);
  for (let i = 1; i <= 10; i++) {
    try {
      const res = await axios.post(TARGET_URL, { eventId: 1, userId: 'user-99' }, {
        headers: { 'X-Idempotency-Key': fixedKey }
      });
      console.log(`Req #${i}: Status ${res.status} | Res:`, JSON.stringify(res.data));
    } catch (err) {
      console.log(`Req #${i}: Failed ${err.message}`);
    }
  }
}
