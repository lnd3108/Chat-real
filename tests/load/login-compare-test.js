import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:5001";
const USERNAME = __ENV.TEST_USERNAME || "vanh";
const PASSWORD = __ENV.TEST_PASSWORD || "1234567";
const MODE = __ENV.MODE || "valid";
const VUS = Number(__ENV.VUS || "20");

export const options = {
  vus: VUS,
  duration: "60s",
  thresholds: {
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  let userName = USERNAME;
  let password = PASSWORD;

  if (MODE === "wrong_password") {
    password = "WrongPassword@123";
  }

  if (MODE === "missing_user") {
    userName = "not_exist_user_999999";
    password = "WrongPassword@123";
  }

  const res = http.post(`${BASE_URL}/api/auth/signin`, JSON.stringify({
    userName,
    password,
  }), {
    headers: {
      "Content-Type": "application/json",
      "X-Load-Test": "true",
    },
    timeout: "5s",
  });

  check(res, {
    "valid mode status 200": (r) => MODE !== "valid" || r.status === 200,
    "invalid mode status not 200": (r) => MODE === "valid" || r.status !== 200,
  });

  sleep(1);
}
