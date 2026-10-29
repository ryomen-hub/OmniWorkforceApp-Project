// Wraps an async route handler so a rejected promise (e.g. a Postgres
// error) gets passed to Express's error handler instead of silently
// hanging the request. better-sqlite3 never needed this — it was fully
// synchronous, so a thrown error propagated normally. pg is promise-based,
// and Express doesn't automatically catch rejected promises from route
// handlers on its own.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
