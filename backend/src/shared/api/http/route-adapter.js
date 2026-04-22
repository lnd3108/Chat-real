import express from "express";

const normalizeHandlers = (handlers) => handlers.flat().filter(Boolean);

export const defineRoute = (method, path, ...handlers) => ({
  method: method.toLowerCase(),
  path,
  handlers: normalizeHandlers(handlers),
});

export const createRouteModule = ({
  routerMiddlewares = [],
  routes = [],
}) => {
  const router = express.Router();

  const normalizedRouterMiddlewares = normalizeHandlers(routerMiddlewares);
  if (normalizedRouterMiddlewares.length > 0) {
    router.use(...normalizedRouterMiddlewares);
  }

  for (const route of routes) {
    router[route.method](route.path, ...route.handlers);
  }

  return router;
};
