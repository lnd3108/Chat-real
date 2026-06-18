import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:5001";
const LOGIN_PATH = __ENV.LOGIN_PATH || "/api/auth/signin";
const TEST_USERNAME = __ENV.TEST_USERNAME;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

if (__ENV.NODE_ENV === "production") {
  throw new Error("Refusing to run load test with NODE_ENV=production.");
}

if (__ENV.LOAD_TEST !== "true") {
  throw new Error("Refusing to run load test unless LOAD_TEST=true.");
}

if (!TEST_USERNAME || !TEST_PASSWORD) {
  throw new Error("Missing TEST_USERNAME or TEST_PASSWORD.");
}

export const options = {
  discardResponseBodies: true,
  stages: [
    { duration: "30s", target: 10 },
    { duration: "30s", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const payload = JSON.stringify({
    userName: TEST_USERNAME,
    password: TEST_PASSWORD,
  });

  const response = http.post(`${BASE_URL}${LOGIN_PATH}`, payload, {
    headers: {
      "Content-Type": "application/json",
      "X-Load-Test": "true",
    },
    tags: { endpoint: "auth_signin_single_user" },
    timeout: "5s",
  });

  check(response, {
    "status is 200": (res) => res.status === 200,
    "response time < 500ms": (res) => res.timings.duration < 500,
  });

  sleep(1);
}
