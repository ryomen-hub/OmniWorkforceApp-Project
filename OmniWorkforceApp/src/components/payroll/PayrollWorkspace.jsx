import { useEffect, useMemo, useState } from "react";
import { adminApiRequest, useAdminRows } from "../../hooks/useAdminRows";
import StatusPill from "../shared/StatusPill";
import "./PayrollWorkspace.css";

const NEXT_STATUS = {
  Draft: "Reviewed",
  Reviewed: "Approved",
  Approved: "Paid",
};

function currency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
}

function displayDate(value) {
  if (!value) return "—";
  return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString();
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function LineItemsEditor({ label, items, onChange }) {
  const update = (index, key, value) => {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  };

  return (
    <section className="payroll-line-editor">
      <div className="payroll-line-heading">
        <h3>{label}</h3>
        <button className="admin-secondary-btn" type="button" onClick={() => onChange([...items, { label: "", amount: "" }])}>+ Add item</button>
      </div>
      {items.length === 0 && <p className="payroll-line-empty">No manually entered items.</p>}
      {items.map((item, index) => (
        <div className="payroll-line-row" key={`${label}-${index}`}>
          <input
            aria-label={`${label} item ${index + 1} description`}
            maxLength="100"
            placeholder="Description (e.g. Night differential)"
            value={item.label}
            onChange={(event) => update(index, "label", event.target.value)}
          />
          <input
            aria-label={`${label} item ${index + 1} amount`}
            min="0"
            placeholder="0.00"
            step="0.01"
            type="number"
            value={item.amount}
            onChange={(event) => update(index, "amount", event.target.value)}
          />
          <button
            aria-label={`Remove ${label.toLowerCase()} item ${index + 1}`}
            className="payroll-remove-line"
            type="button"
            onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
          >×</button>
        </div>
      ))}
    </section>
  );
}

export default function PayrollWorkspace({ authHeader, showToast }) {
  const { rows: runs, loading, error, reload } = useAdminRows("/payroll-runs", authHeader);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedRun, setSelectedRun] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payoutDate, setPayoutDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingSlip, setEditingSlip] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [actionError, setActionError] = useState("");
  const [printingSlipId, setPrintingSlipId] = useState("");

  const latestRuns = useMemo(() => runs, [runs]);

  const loadRun = async (runId) => {
    if (!runId) {
      setSelectedRun(null);
      return;
    }
    setDetailLoading(true);
    setActionError("");
    try {
      const run = await adminApiRequest(`/payroll-runs/${runId}`, authHeader);
      setSelectedRun(run);
    } catch (requestError) {
      setActionError(requestError.message || "Could not load payroll run.");
      setSelectedRun(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRunId) loadRun(selectedRunId);
    else setSelectedRun(null);
  }, [selectedRunId, authHeader]);

  const createRun = async (event) => {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    try {
      const run = await adminApiRequest("/payroll-runs", authHeader, {
        method: "POST",
        body: JSON.stringify({
          period_start: periodStart,
          period_end: periodEnd,
          payout_date: payoutDate,
        }),
      });
      setPeriodStart("");
      setPeriodEnd("");
      setPayoutDate("");
      setCreateOpen(false);
      await reload();
      setSelectedRunId(String(run.id));
      showToast("Draft payroll run created.");
    } catch (requestError) {
      setActionError(requestError.message || "Could not create payroll run.");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (slip) => {
    setEditingSlip(String(slip.id));
    setEarnings((slip.earnings || []).map((item) => ({ label: item.label, amount: String(item.amount) })));
    setDeductions((slip.deductions || []).map((item) => ({ label: item.label, amount: String(item.amount) })));
    setActionError("");
  };

  const saveSlip = async (event) => {
    event.preventDefault();
    if (!selectedRun || !editingSlip) return;
    setSaving(true);
    setActionError("");
    try {
      await adminApiRequest(`/payroll-runs/${selectedRun.id}/payslips/${editingSlip}`, authHeader, {
        method: "PATCH",
        body: JSON.stringify({ earnings, deductions }),
      });
      setEditingSlip(null);
      await loadRun(selectedRun.id);
      await reload();
      showToast("Payslip amounts saved.");
    } catch (requestError) {
      setActionError(requestError.message || "Could not save payslip amounts.");
    } finally {
      setSaving(false);
    }
  };

  const advanceRun = async () => {
    if (!selectedRun) return;
    const nextStatus = NEXT_STATUS[selectedRun.status];
    if (!nextStatus) return;
    if (nextStatus === "Paid" && !window.confirm("Confirm that this payroll has been paid out?")) return;
    setSaving(true);
    setActionError("");
    try {
      const updated = await adminApiRequest(`/payroll-runs/${selectedRun.id}/status`, authHeader, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setSelectedRun({ ...selectedRun, ...updated });
      await loadRun(selectedRun.id);
      await reload();
      showToast(`Payroll run moved to ${nextStatus}.`);
    } catch (requestError) {
      setActionError(requestError.message || "Could not update payroll status.");
    } finally {
      setSaving(false);
    }
  };

  const printPayslip = (slip) => {
    if (!selectedRun || !["Approved", "Paid"].includes(selectedRun.status)) return;
    setPrintingSlipId(String(slip.id));
    const printWindow = window.open("", "_blank", "width=850,height=750");
    if (!printWindow) {
      setPrintingSlipId("");
      showToast("Allow pop-ups to print an approved payslip.");
      return;
    }
    const earningsRows = [
      { label: "Basic Pay", amount: slip.basic_pay },
      ...(slip.earnings || []),
    ].map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(currency(item.amount))}</td></tr>`).join("");
    const deductionRows = (slip.deductions || [])
      .map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(currency(item.amount))}</td></tr>`).join("");

    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${escapeHtml(slip.employee_code)}</title><style>
      body{font:14px Arial,sans-serif;color:#0f172a;margin:40px auto;max-width:760px;padding:24px}
      h1{font-size:24px;margin:0}h2{font-size:16px;margin:28px 0 8px}
      .brand{display:flex;gap:12px;align-items:center;border-bottom:2px solid #2563eb;padding-bottom:16px}
      .logo{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:#2563eb;color:#fff;font-weight:bold}
      .muted{color:#64748b;font-size:12px;margin-top:5px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 30px;margin-top:22px}
      .field{padding:8px 0;border-bottom:1px solid #e2e8f0}.field b{display:block;color:#64748b;font-size:10px;text-transform:uppercase;margin-bottom:4px}
      table{width:100%;border-collapse:collapse}td{padding:9px 6px;border-bottom:1px solid #e2e8f0}td:last-child{text-align:right}
      .total td{font-weight:bold;border-top:2px solid #cbd5e1}.net{margin-top:24px;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:18px;font-weight:bold;display:flex;justify-content:space-between}
      .status{text-align:right;color:#166534;font-size:11px;font-weight:bold;text-transform:uppercase}
      button{margin-top:24px;padding:10px 16px}@media print{button{display:none}body{margin:0;padding:20px}}
    </style></head><body>
      <div class="brand"><div class="logo">OW</div><div><h1>OmniWorkforce</h1><div class="muted">Employee Payroll Statement</div></div><div class="status">${escapeHtml(selectedRun.status)}</div></div>
      <div class="grid">
        <div class="field"><b>Employee</b>${escapeHtml(slip.employee_name)}</div>
        <div class="field"><b>Employee ID</b>${escapeHtml(slip.employee_code)}</div>
        <div class="field"><b>Job Title / Account</b>${escapeHtml(slip.position || "—")}</div>
        <div class="field"><b>Pay Period</b>${escapeHtml(displayDate(selectedRun.period_start))} – ${escapeHtml(displayDate(selectedRun.period_end))}</div>
        <div class="field"><b>Payout Date</b>${escapeHtml(displayDate(selectedRun.payout_date))}</div>
        <div class="field"><b>Monthly Base Salary</b>${escapeHtml(currency(slip.monthly_base_salary))}</div>
      </div>
      <h2>Earnings</h2><table>${earningsRows}<tr class="total"><td>Gross Pay</td><td>${escapeHtml(currency(slip.gross_pay))}</td></tr></table>
      <h2>Deductions</h2><table>${deductionRows || "<tr><td>No deductions entered</td><td>" + escapeHtml(currency(0)) + "</td></tr>"}<tr class="total"><td>Total Deductions</td><td>${escapeHtml(currency(slip.total_deductions))}</td></tr></table>
      <div class="net"><span>Net Take-Home Pay</span><span>${escapeHtml(currency(slip.net_pay))}</span></div>
      <p class="muted">Variable earnings and deductions shown are amounts entered and approved by payroll. This payslip is based on the saved payroll-run snapshot.</p>
      <button onclick="window.print()">Print payslip</button>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setPrintingSlipId("");
  };

  const selectedStatus = selectedRun?.status;
  const totalNet = selectedRun?.payslips?.reduce((sum, slip) => sum + Number(slip.net_pay), 0) ?? 0;
  const hasNegativeNetPay = selectedRun?.payslips?.some((slip) => Number(slip.net_pay) < 0) ?? false;

  return (
    <section className="payroll-workspace">
      <div className="admin-page-heading">
        <div><h1>Payroll Runs &amp; Payslips</h1><p>Semi-monthly base pay is monthly salary divided by two. Enter approved variable amounts manually.</p></div>
        <button className="btn-primary btn-small admin-heading-action" onClick={() => setCreateOpen((open) => !open)}>{createOpen ? "Cancel" : "+ Create Payroll Run"}</button>
      </div>
      {actionError && <div className="admin-notice admin-notice-error" role="alert">{actionError}</div>}
      {createOpen && (
        <form className="dash-card payroll-create-form" onSubmit={createRun}>
          <h2>New semi-monthly payroll run</h2>
          <p>Use a 1st–15th or 16th–month-end cutoff. Creates a draft payslip for every current payroll record, using its employee ID, name, position, and monthly base salary.</p>
          <div className="payroll-date-grid">
            <label>Period start<input required type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></label>
            <label>Period end<input required min={periodStart || undefined} type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></label>
            <label>Payout date<input required type="date" value={payoutDate} onChange={(event) => setPayoutDate(event.target.value)} /></label>
          </div>
          <button className="btn-primary btn-small" disabled={saving}>{saving ? "Creating…" : "Create Draft Run"}</button>
        </form>
      )}
      <div className="payroll-layout">
        <aside className="dash-card payroll-run-list">
          <h2>Payroll periods</h2>
          {loading ? <div className="admin-notice">Loading payroll runs…</div> : error ? <div className="admin-notice admin-notice-error" role="alert">{error}</div> : latestRuns.length === 0 ? <div className="admin-notice">No payroll runs yet.</div> : latestRuns.map((run) => (
            <button
              className={`payroll-run-item ${String(run.id) === String(selectedRunId) ? "active" : ""}`}
              key={run.id}
              onClick={() => setSelectedRunId(String(run.id))}
            >
              <strong>{displayDate(run.period_start)} – {displayDate(run.period_end)}</strong>
              <span>Payout {displayDate(run.payout_date)}</span>
              <span className="payroll-run-item-meta">{run.employee_count} employees · {currency(run.total_net_pay)}</span>
              <StatusPill type={run.status === "Approved" || run.status === "Paid" ? "verified" : run.status === "Reviewed" ? "interview" : "pending"}>{run.status}</StatusPill>
            </button>
          ))}
        </aside>
        <div className="payroll-run-detail">
          {!selectedRunId ? (
            <div className="dash-card payroll-empty"><h2>Select a payroll period</h2><p>Create a draft run or choose a period to view its payslips.</p></div>
          ) : detailLoading ? (
            <div className="dash-card admin-notice">Loading payroll run…</div>
          ) : selectedRun && (
            <>
              <div className="dash-card payroll-run-header">
                <div>
                  <h2>{displayDate(selectedRun.period_start)} – {displayDate(selectedRun.period_end)}</h2>
                  <p>Payout date: {displayDate(selectedRun.payout_date)} · {selectedRun.payslips.length} employees</p>
                  <StatusPill type={selectedStatus === "Approved" || selectedStatus === "Paid" ? "verified" : selectedStatus === "Reviewed" ? "interview" : "pending"}>{selectedStatus}</StatusPill>
                </div>
                <div className="payroll-run-total"><span>Total net pay</span><strong>{currency(totalNet)}</strong></div>
                {NEXT_STATUS[selectedStatus] && <button className="btn-primary btn-small payroll-status-button" disabled={saving || !selectedRun.payslips.length || (hasNegativeNetPay && ["Reviewed", "Approved"].includes(NEXT_STATUS[selectedStatus]))} onClick={advanceRun}>{saving ? "Saving…" : NEXT_STATUS[selectedStatus] === "Paid" ? "Confirm Paid" : `Mark ${NEXT_STATUS[selectedStatus]}`}</button>}
              </div>
              {hasNegativeNetPay && <div className="admin-notice admin-notice-error" role="alert">At least one payslip has deductions greater than gross pay. Correct the draft amounts before reviewing or approving this run.</div>}
              {selectedStatus !== "Draft" && <div className="payroll-lock-note">Payslip amounts are locked after the run leaves Draft.</div>}
              <div className="payroll-slip-list">
                {selectedRun.payslips.map((slip) => (
                  <article className="dash-card payroll-slip-card" key={slip.id}>
                    <div className="payroll-slip-heading">
                      <div><h3>{slip.employee_name}</h3><p>{slip.employee_code} · {slip.position || "Position not specified"}</p></div>
                      <div className="payroll-slip-net"><span>Net pay</span><strong>{currency(slip.net_pay)}</strong></div>
                    </div>
                    <div className="payroll-slip-summary">
                      <span>Basic pay <strong>{currency(slip.basic_pay)}</strong></span>
                      <span>Gross pay <strong>{currency(slip.gross_pay)}</strong></span>
                      <span>Deductions <strong>{currency(slip.total_deductions)}</strong></span>
                    </div>
                    <div className="payroll-slip-actions">
                      {selectedStatus === "Draft" && <button className="admin-secondary-btn" onClick={() => startEditing(slip)}>{String(slip.id) === editingSlip ? "Editing amounts below" : "Edit earnings & deductions"}</button>}
                      {["Approved", "Paid"].includes(selectedStatus) && <button className="admin-secondary-btn" disabled={printingSlipId === String(slip.id)} onClick={() => printPayslip(slip)}>Print payslip</button>}
                      {!["Draft", "Approved", "Paid"].includes(selectedStatus) && <span className="payroll-approval-note">Available to print after approval</span>}
                    </div>
                    {String(slip.id) === editingSlip && selectedStatus === "Draft" && (
                      <form className="payroll-edit-form" onSubmit={saveSlip}>
                        <div className="payroll-basic-pay-note">Basic pay is fixed at half of monthly base salary: {currency(slip.monthly_base_salary)} ÷ 2 = <strong>{currency(slip.basic_pay)}</strong></div>
                        <div className="payroll-edit-columns">
                          <LineItemsEditor label="Earnings" items={earnings} onChange={setEarnings} />
                          <LineItemsEditor label="Deductions" items={deductions} onChange={setDeductions} />
                        </div>
                        <p className="payroll-manual-note">Enter verified amounts only. Tax and statutory deductions are manual; this system does not calculate their rates.</p>
                        <div className="admin-form-actions">
                          <button className="btn-primary btn-small" type="submit" disabled={saving}>{saving ? "Saving…" : "Save Payslip Items"}</button>
                          <button className="admin-secondary-btn" type="button" onClick={() => setEditingSlip(null)}>Cancel</button>
                        </div>
                      </form>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
