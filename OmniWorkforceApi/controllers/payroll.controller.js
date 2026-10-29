import PayrollRecord from "../models/PayrollRecord.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const getAll = asyncHandler(async (req, res) => {
  res.json(await PayrollRecord.getAll());
});

export const getOne = asyncHandler(async (req, res) => {
  const record = await PayrollRecord.getById(req.params.id);
  if (!record) return res.status(404).json({ error: "Payroll record not found" });
  res.json(record);
});

export const create = asyncHandler(async (req, res) => {
  const { applicant_id, employee_code, position, base_salary, sync_source } = req.body;
  if (!applicant_id || !employee_code) {
    return res.status(400).json({ error: "applicant_id and employee_code are required" });
  }
  res.status(201).json(
    await PayrollRecord.create({ applicant_id, employee_code, position, base_salary, sync_source })
  );
});

export const update = asyncHandler(async (req, res) => {
  const updated = await PayrollRecord.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Payroll record not found" });
  res.json(updated);
});

export const remove = asyncHandler(async (req, res) => {
  await PayrollRecord.remove(req.params.id);
  res.status(204).end();
});
