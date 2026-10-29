// Usage: router.delete("/:id", requireAuth, requireRole("Admin Office"), controller.remove)
//
// Must run AFTER requireAuth — it reads req.user.role, which requireAuth sets.
// Takes any number of allowed roles so a route can permit more than one,
// e.g. requireRole("Admin Office", "Recruiters & HR").
export function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      // Programmer error (middleware used out of order), not a client error
      return res.status(500).json({ error: "requireRole used without requireAuth" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `This action requires one of these roles: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
}
