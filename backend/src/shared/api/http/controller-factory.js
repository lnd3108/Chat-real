import { sendSuccess } from "../../../utils/controllerResponses.js";
import {
  markSigninPipelineControllerEnd,
  markSigninPipelineControllerStart,
} from "../../infrastructure/perf/signin-pipeline-timing.js";

const sendPresented = (res, presented) => {
  if (presented?.type === "sendStatus") {
    return res.sendStatus(presented.status);
  }

  if (presented?.type === "redirect") {
    return res.redirect(presented.status ?? 302, presented.location);
  }

  return sendSuccess(res, presented.body, presented.status);
};

export const makeQueryHandler = ({
  execute,
  present,
  onError,
}) => async (req, res) => {
  try {
    return sendPresented(res, present(await execute(req)));
  } catch (error) {
    return onError(error, req, res);
  }
};

export const makeCommandHandler = ({
  execute,
  present,
  onError,
}) => async (req, res) => {
  markSigninPipelineControllerStart(req);
  try {
    const result = sendPresented(res, present(await execute(req, res)));
    markSigninPipelineControllerEnd(req);
    return result;
  } catch (error) {
    markSigninPipelineControllerEnd(req);
    return onError(error, req, res);
  }
};
