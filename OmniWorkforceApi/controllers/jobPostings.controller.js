import JobPosting from "../models/JobPosting.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const ALLOWED_STATUSES = ["Active", "Paused", "Closed"];

export const getAll = asyncHandler(async (req, res) => {
  res.json(await JobPosting.getAll());
});

export const create = asyncHandler(async (req, res) => {
  const title = typeof req.body.title === "string" ? req.body.title.trim() : "";
  const department = typeof req.body.department === "string" ? req.body.department.trim() : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  if (!title || !department) {
    return res.status(400).json({ error: "title and department are required" });
  }
  res.status(201).json(await JobPosting.create({
    title,
    department,
    description,
    created_by: req.user.id,
  }));
});

export const update = asyncHandler(async (req, res) => {
  const { title, department, description, status } = req.body;
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: "status must be Active, Paused, or Closed" });
  }
  for (const [field, value] of Object.entries({ title, department, description })) {
    if (value !== undefined && typeof value !== "string") {
      return res.status(400).json({ error: `${field} must be a string` });
    }
  }
  if ((title !== undefined && !title.trim()) || (department !== undefined && !department.trim())) {
    return res.status(400).json({ error: "title and department cannot be empty" });
  }
  const updated = await JobPosting.update(req.params.id, {
    title: title?.trim(),
    department: department?.trim(),
    description: description?.trim(),
    status,
  });
  if (!updated) return res.status(404).json({ error: "Job posting not found" });
  res.json(updated);
});

export const remove = asyncHandler(async (req, res) => {
  const removed = await JobPosting.remove(req.params.id);
  if (!removed) return res.status(404).json({ error: "Job posting not found" });
  res.status(204).end();
});
