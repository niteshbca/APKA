import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Button, Card, Field, StatCard, Badge } from '../components/ui';
import CrudPage from '../components/CrudPage';
import { money } from '../utils/format';

const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

const tabs = [
  { key: 'employees', label: 'Employees' },
  { key: 'salary', label: 'Salary / Payroll' },
  { key: 'attendance', label: 'Attendance' },
];

export default function HR() {
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [salaryMonth, setSalaryMonth] = useState(currentMonth());
  const [attDate, setAttDate] = useState(today());
  const { toast } = useToast();

  const loadEmployees = useCallback(() => {
    api.get('/hr/employees', { params: { limit: 500 } }).then((r) => setEmployees(r.data.data || [])).catch(() => {});
  }, []);

  const loadSummary = useCallback(() => {
    api.get('/hr/summary', { params: { month: salaryMonth } }).then((r) => setSummary(r.data.data)).catch(() => {});
  }, [salaryMonth]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const employeeOptions = employees.map((e) => ({ value: e._id, label: `${e.name}${e.designation ? ` — ${e.designation}` : ''}` }));

  const generateSalary = async () => {
    try {
      const r = await api.post('/hr/salary/generate', { month: salaryMonth });
      toast(`Generated ${r.data.data.created} salary records (${r.data.data.skipped} already existed)`, 'success');
      loadSummary();
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>HR & Staff</h2>
      </div>

      <div className="kpi-grid mb-16">
        <StatCard label="Active staff" value={summary?.activeCount ?? '—'} icon="👥" />
        <StatCard label="Monthly payroll" value={summary ? money(summary.monthlyPayroll) : '—'} icon="💼" />
        <StatCard label="Paid this month" value={summary ? money(summary.paidAmount) : '—'} tone="success" icon="✅" />
        <StatCard label="Pending salary" value={summary ? money(summary.pendingAmount) : '—'} tone="warning" icon="⏳" />
      </div>

      <div className="flex gap-8 mb-16">
        {tabs.map((t) => (
          <Button key={t.key} size="sm" variant={tab === t.key ? 'primary' : 'ghost'} onClick={() => setTab(t.key)}>{t.label}</Button>
        ))}
      </div>

      {tab === 'employees' && (
        <CrudPage
          endpoint="/hr/employees"
          title="Employees"
          addLabel="Add Employee"
          searchPlaceholder="Search name / phone / code…"
          onLoaded={loadEmployees}
          emptyForm={{ name: '', code: '', phone: '', email: '', designation: '', department: '', joinDate: '', salaryType: 'monthly', salary: '', address: '', bankAccount: '', ifsc: '', status: 'active', notes: '' }}
          toForm={(r) => ({
            name: r.name || '', code: r.code || '', phone: r.phone || '', email: r.email || '',
            designation: r.designation || '', department: r.department || '',
            joinDate: r.joinDate ? String(r.joinDate).slice(0, 10) : '', salaryType: r.salaryType || 'monthly',
            salary: r.salary ?? '', address: r.address || '', bankAccount: r.bankAccount || '',
            ifsc: r.ifsc || '', status: r.status || 'active', notes: r.notes || '',
          })}
          toPayload={(f) => ({ ...f, salary: Number(f.salary) || 0 })}
          columns={[
            { key: 'name', label: 'Name', render: (r) => <b>{r.name}</b> },
            { key: 'designation', label: 'Designation' },
            { key: 'department', label: 'Department' },
            { key: 'phone', label: 'Phone' },
            { key: 'salary', label: 'Salary', align: 'right', render: (r) => money(r.salary) },
            { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status}</Badge> },
          ]}
          fields={[
            { key: 'name', label: 'Full name *' },
            { key: 'code', label: 'Employee code' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email' },
            { key: 'designation', label: 'Designation' },
            { key: 'department', label: 'Department' },
            { key: 'joinDate', label: 'Joining date', type: 'date' },
            { key: 'salaryType', label: 'Salary type', type: 'select', options: [{ value: 'monthly', label: 'Monthly' }, { value: 'daily', label: 'Daily' }] },
            { key: 'salary', label: 'Salary amount', type: 'number' },
            { key: 'address', label: 'Address' },
            { key: 'bankAccount', label: 'Bank account' },
            { key: 'ifsc', label: 'IFSC' },
            { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
            { key: 'notes', label: 'Notes', type: 'textarea' },
          ]}
        />
      )}

      {tab === 'salary' && (
        <div>
          <div className="flex-between mb-16">
            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              <span className="muted">Month</span>
              <input type="month" className="input" style={{ maxWidth: 180 }} value={salaryMonth} onChange={(e) => { setSalaryMonth(e.target.value); loadSummary(); }} />
            </div>
            <Button onClick={generateSalary}>Generate for {salaryMonth}</Button>
          </div>
          <CrudPage
            endpoint="/hr/salary"
            params={{ month: salaryMonth }}
            title={`Salary — ${salaryMonth}`}
            addLabel="Add Salary Record"
            search={false}
            emptyForm={{ employee: '', month: salaryMonth, basic: '', allowances: 0, deductions: 0, status: 'pending', paymentMode: 'cash', note: '' }}
            toForm={(r) => ({ employee: r.employee, month: r.month, basic: r.basic, allowances: r.allowances, deductions: r.deductions, status: r.status, paymentMode: r.paymentMode, note: r.note })}
            toPayload={(f) => ({ ...f, basic: Number(f.basic) || 0, allowances: Number(f.allowances) || 0, deductions: Number(f.deductions) || 0 })}
            rowActions={(row, reload) => row.status === 'pending' && (
              <Button size="sm" variant="ghost" onClick={async () => {
                try { await api.put(`/hr/salary/${row._id}`, { status: 'paid' }); toast('Marked paid', 'success'); reload(); loadSummary(); }
                catch (e) { toast(e.message, 'error'); }
              }}>Mark Paid</Button>
            )}
            columns={[
              { key: 'employeeName', label: 'Employee', render: (r) => <b>{r.employeeName || '—'}</b> },
              { key: 'basic', label: 'Basic', align: 'right', render: (r) => money(r.basic) },
              { key: 'allowances', label: 'Allow.', align: 'right', render: (r) => money(r.allowances) },
              { key: 'deductions', label: 'Deduct.', align: 'right', render: (r) => money(r.deductions) },
              { key: 'netPay', label: 'Net pay', align: 'right', render: (r) => <b>{money(r.netPay)}</b> },
              { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'paid' ? 'success' : 'warning'}>{r.status}</Badge> },
            ]}
            fields={[
              { key: 'employee', label: 'Employee *', type: 'select', options: employeeOptions },
              { key: 'month', label: 'Month (YYYY-MM) *' },
              { key: 'basic', label: 'Basic', type: 'number' },
              { key: 'allowances', label: 'Allowances', type: 'number' },
              { key: 'deductions', label: 'Deductions', type: 'number' },
              { key: 'status', label: 'Status', type: 'select', options: [{ value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }] },
              { key: 'paymentMode', label: 'Payment mode' },
              { key: 'note', label: 'Note', type: 'textarea' },
            ]}
          />
        </div>
      )}

      {tab === 'attendance' && (
        <div>
          <div className="flex-between mb-16">
            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              <span className="muted">Date</span>
              <input type="date" className="input" style={{ maxWidth: 200 }} value={attDate} onChange={(e) => setAttDate(e.target.value)} />
            </div>
          </div>
          <CrudPage
            endpoint="/hr/attendance"
            params={{ date: attDate }}
            title={`Attendance — ${attDate}`}
            addLabel="Mark Attendance"
            search={false}
            emptyForm={{ employee: '', date: attDate, status: 'present', note: '' }}
            toForm={(r) => ({ employee: r.employee, date: r.date, status: r.status, note: r.note })}
            columns={[
              { key: 'employeeName', label: 'Employee', render: (r) => <b>{r.employeeName || '—'}</b> },
              { key: 'date', label: 'Date' },
              { key: 'status', label: 'Status', render: (r) => <Badge tone={r.status === 'present' ? 'success' : r.status === 'absent' ? 'danger' : 'warning'}>{r.status}</Badge> },
              { key: 'note', label: 'Note' },
            ]}
            fields={[
              { key: 'employee', label: 'Employee *', type: 'select', options: employeeOptions },
              { key: 'date', label: 'Date', type: 'date' },
              { key: 'status', label: 'Status', type: 'select', options: [{ value: 'present', label: 'Present' }, { value: 'absent', label: 'Absent' }, { value: 'half_day', label: 'Half day' }, { value: 'leave', label: 'Leave' }] },
              { key: 'note', label: 'Note' },
            ]}
          />
        </div>
      )}
    </div>
  );
}
