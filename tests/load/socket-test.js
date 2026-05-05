"use strict";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5001";

module.exports = {
  config: {
    target: BASE_URL,
    processor: "./socket-processor.cjs",
    phases: [
      {
        duration: 30,
        arrivalCount: 5,
        maxVusers: 5,
        name: "safe start: 5 socket users",
      },
      {
        duration: 30,
        arrivalCount: 20,
        maxVusers: 20,
        name: "ramp: 20 socket users",
      },
      {
        duration: 30,
        arrivalCount: 50,
        maxVusers: 50,
        name: "ramp: 50 socket users",
      },
    ],
  },
  scenarios: [
    {
      name: "login and maintain Socket.IO connection",
      flow: [{ function: "runSocketUser" }],
    },
  ],
};
