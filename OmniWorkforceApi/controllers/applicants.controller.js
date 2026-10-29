import Applicant from "../models/Applicant.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { notifyUser } from "../services/notify.js";

export const getAll = asyncHandler(async (req, res) => {
  res.json(await Applicant.getAll());
});

export const getOne = asyncHandler(async (req, res) => {
  const applicant = await Applicant.getById(req.params.id);
  if (!applicant) return res.status(404).json({ error: "Applicant not found" });
  res.json(applicant);
});

// referred_by is always the logged-in user's own ID, from the verified token
export const create = asyncHandler(async (req, res) => {
  const { name, email, job_offer, salary, job_posting_id } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  if (job_posting_id !== undefined && job_posting_id !== null && !/^\d+$/.test(String(job_posting_id))) {
    return res.status(400).json({ error: "job_posting_id must be a valid posting ID" });
  }
  res.status(201).json(
    await Applicant.create({ name, email, job_offer, salary, referred_by: req.user.id, job_posting_id })
  );
});

// Matches the "Advance Stage" button in the frontend
export const update = asyncHandler(async (req, res) => {
  if (req.body.job_posting_id !== undefined
    && req.body.job_posting_id !== null
    && !/^\d+$/.test(String(req.body.job_posting_id))) {
    return res.status(400).json({ error: "job_posting_id must be a valid posting ID" });
  }
  const before = await Applicant.getById(req.params.id);
  const updated = await Applicant.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Applicant not found" });

  // Notify whoever referred this applicant when the stage actually changed —
  // but not if they're the one who changed it (no notifying yourself).
  const stageChanged = before && before.bpo_status !== updated.bpo_status;
  if (stageChanged && updated.referred_by && String(updated.referred_by) !== String(req.user.id)) {
    await notifyUser(
      updated.referred_by,
      "Applicant stage updated",
      `${updated.name} moved to ${updated.bpo_status}.`
    );
  }

  res.json(updated);
});

export const remove = asyncHandler(async (req, res) => {
  await Applicant.remove(req.params.id);
  res.status(204).end();
});
