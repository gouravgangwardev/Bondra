import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const queueJoinDuration = new Trend('queue_join_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Spike to 200 users
    { duration: '2m', target: 100 },  // Scale down to 100
    { duration: '1m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'], // Less than 1% errors
    errors: ['rate<0.05'], // Less than 5% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test data
function generateRandomString(length = 8) {
  return Math.random().toString(36).substring(2, length + 2);
}

// Test scenarios
export default function () {
  const scenario = Math.random();

  if (scenario < 0.2) {
    testHealthCheck();
  } else if (scenario < 0.4) {
    testGuestCreation();
  } else if (scenario < 0.6) {
    testUserRegistration();
  } else if (scenario < 0.8) {
    testLoginFlow();
  } else {
    testFullUserJourney();
  }

  sleep(1);
}

function testHealthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  
  check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check has ok status': (r) => r.json('status') === 'ok',
  });

  errorRate.add(res.status !== 200);
}

function testGuestCreation() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/guest`,
    JSON.stringify({}),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const success = check(res, {
    'guest creation status is 201': (r) => r.status === 201,
    'guest has access token': (r) => r.json('data.accessToken') !== undefined,
  });

  errorRate.add(!success);
}

function testUserRegistration() {
  const payload = JSON.stringify({
    username: `user_${generateRandomString()}`,
    email: `test_${generateRandomString()}@example.com`,
    password: 'Test1234',
  });

  const res = http.post(`${BASE_URL}/api/v1/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(res, {
    'registration status is 201': (r) => r.status === 201,
    'has access token': (r) => r.json('data.accessToken') !== undefined,
  });

  errorRate.add(!success);
}

function testLoginFlow() {
  // Register
  const username = `testuser_${generateRandomString()}`;
  const email = `test_${generateRandomString()}@example.com`;
  const password = 'Password123';

  const registerRes = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({ username, email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (registerRes.status !== 201) {
    errorRate.add(true);
    return;
  }

  sleep(0.5);

  // Login
  const loginStart = Date.now();
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ username, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  loginDuration.add(Date.now() - loginStart);

  const success = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has token': (r) => r.json('data.accessToken') !== undefined,
  });

  errorRate.add(!success);
}

function testFullUserJourney() {
  // 1. Register
  const username = `journey_${generateRandomString()}`;
  const email = `journey_${generateRandomString()}@example.com`;
  const password = 'Password123';

  const registerRes = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({ username, email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (registerRes.status !== 201) {
    errorRate.add(true);
    return;
  }

  const token = registerRes.json('data.accessToken');
  sleep(0.5);

  // 2. Get profile
  const profileRes = http.get(`${BASE_URL}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(profileRes, {
    'profile fetch is 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // 3. Update profile
  const updateRes = http.put(
    `${BASE_URL}/api/v1/users/profile`,
    JSON.stringify({ username: `${username}_updated` }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  check(updateRes, {
    'profile update is 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // 4. Search users
  const searchRes = http.get(`${BASE_URL}/api/v1/users/search?q=test`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(searchRes, {
    'search is 200': (r) => r.status === 200,
  });

  errorRate.add(
    registerRes.status !== 201 ||
    profileRes.status !== 200 ||
    updateRes.status !== 200 ||
    searchRes.status !== 200
  );
}

// Teardown
export function teardown(data) {
  console.log('Test completed');
}