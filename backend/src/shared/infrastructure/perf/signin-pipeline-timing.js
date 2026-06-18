import cluster from "node:cluster";
import { performance } from "node:perf_hooks";

const SIGNIN_PIPELINE_TIMING_KEY = Symbol.for("chatrt.signinPipelineTiming");
const DEFAULT_SAMPLE_RATE = 0.05;
const DEFAULT_SLOW_MS = 500;

const isEnabled = () => process.env.SIGNIN_PIPELINE_TIMING_ENABLED === "true";

const readNumberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
};

const getSampleRate = () => {
  const value = readNumberEnv("SIGNIN_PIPELINE_SAMPLE_RATE", DEFAULT_SAMPLE_RATE);
  return Math.max(0, Math.min(value, 1));
};

const getSlowMs = () => {
  const value = readNumberEnv("SIGNIN_PIPELINE_SLOW_MS", DEFAULT_SLOW_MS);
  return Math.max(0, value);
};

const roundMs = (value) =>
  Number.isFinite(value) ? Number(value.toFixed(3)) : null;

const elapsedMs = (startedAt, endedAt = performance.now()) =>
  roundMs(endedAt - startedAt);

const getState = (req) => req?.[SIGNIN_PIPELINE_TIMING_KEY] ?? null;

const routePath = (req) => {
  const baseUrl = req.baseUrl || "";
  const path = req.route?.path || req.path || "";
  return `${baseUrl}${path}` || req.originalUrl?.split("?")[0] || "";
};

const buildPayload = ({ req, res, state, finishedAt }) => {
  const totalReqMs = elapsedMs(state.startedAt, finishedAt);
  const responseFinishMs = state.controllerEndedAt
    ? elapsedMs(state.controllerEndedAt, finishedAt)
    : null;
  const slow = totalReqMs >= state.slowMs;

  return {
    pid: process.pid,
    workerId: cluster.isWorker ? cluster.worker?.id : null,
    method: req.method,
    path: routePath(req),
    statusCode: res.statusCode,
    totalReqMs,
    controllerMs: state.controllerMs ?? null,
    serviceTotalMs: state.serviceTiming.serviceTotalMs ?? null,
    userLookupMs: state.serviceTiming.userLookupMs ?? null,
    userLookupBuildMs: state.serviceTiming.userLookupBuildMs ?? null,
    userLookupAwaitMs: state.serviceTiming.userLookupAwaitMs ?? null,
    userLookupPostMs: state.serviceTiming.userLookupPostMs ?? null,
    authUserCacheEnabled: state.serviceTiming.authUserCacheEnabled ?? null,
    authUserCacheHit: state.serviceTiming.authUserCacheHit ?? null,
    authUserCacheReadMs: state.serviceTiming.authUserCacheReadMs ?? null,
    authUserCacheWriteMs: state.serviceTiming.authUserCacheWriteMs ?? null,
    authUserCacheFallbackReason:
      state.serviceTiming.authUserCacheFallbackReason ?? null,
    bcryptMs: state.serviceTiming.bcryptMs ?? null,
    maintenanceCheckMs: state.serviceTiming.maintenanceCheckMs ?? null,
    maintenanceL1Enabled: state.serviceTiming.maintenanceL1Enabled ?? null,
    maintenanceL1Hit: state.serviceTiming.maintenanceL1Hit ?? null,
    maintenanceSource: state.serviceTiming.maintenanceSource ?? null,
    maintenanceSingleFlightShared:
      state.serviceTiming.maintenanceSingleFlightShared ?? null,
    maintenanceReadMs: state.serviceTiming.maintenanceReadMs ?? null,
    maintenanceDecisionMs: state.serviceTiming.maintenanceDecisionMs ?? null,
    createSessionMs: state.serviceTiming.createSessionMs ?? null,
    responseFinishMs,
    sampled: state.sampled,
    slow,
  };
};

export const signinPipelineTimingMiddleware = (req, res, next) => {
  if (!isEnabled()) {
    return next();
  }

  const state = {
    startedAt: performance.now(),
    sampled: Math.random() < getSampleRate(),
    slowMs: getSlowMs(),
    serviceTiming: {},
    controllerStartedAt: null,
    controllerEndedAt: null,
    controllerMs: null,
  };

  req[SIGNIN_PIPELINE_TIMING_KEY] = state;

  res.on("finish", () => {
    const finishedAt = performance.now();
    const payload = buildPayload({ req, res, state, finishedAt });

    if (!payload.sampled && !payload.slow) {
      return;
    }

    console.log(`[SigninPipelineTiming] ${JSON.stringify(payload)}`);
  });

  return next();
};

export const markSigninPipelineControllerStart = (req) => {
  const state = getState(req);
  if (!state) {
    return;
  }

  state.controllerStartedAt = performance.now();
};

export const markSigninPipelineControllerEnd = (req) => {
  const state = getState(req);
  if (!state || !state.controllerStartedAt) {
    return;
  }

  state.controllerEndedAt = performance.now();
  state.controllerMs = elapsedMs(
    state.controllerStartedAt,
    state.controllerEndedAt,
  );
};

export const recordSigninPipelineServiceTiming = (req, serviceTiming = {}) => {
  const state = getState(req);
  if (!state) {
    return;
  }

  state.serviceTiming = {
    ...state.serviceTiming,
    ...serviceTiming,
  };
};
