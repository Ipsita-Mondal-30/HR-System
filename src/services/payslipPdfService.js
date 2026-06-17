const PDFDocument = require('pdfkit');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
}

function getCompanyName() {
  return process.env.COMPANY_NAME || 'HR Company';
}

function drawWatermark(doc, companyName) {
  const { width, height } = doc.page;
  doc.save();
  doc.opacity(0.06);
  doc.fillColor('#2563eb');
  doc.fontSize(52);
  doc.rotate(-35, { origin: [width / 2, height / 2] });
  doc.text(companyName.toUpperCase(), width / 2 - 180, height / 2 - 20, {
    width: 360,
    align: 'center'
  });
  doc.restore();
}

function drawCompanyStamp(doc, companyName) {
  const cx = doc.page.width - 95;
  const cy = doc.page.height - 95;
  const radius = 42;

  doc.save();
  doc.lineWidth(2).strokeColor('#1d4ed8');
  doc.circle(cx, cy, radius).stroke();
  doc.circle(cx, cy, radius - 6).stroke();

  doc.fillColor('#1d4ed8').fontSize(7);
  doc.text('OFFICIAL PAYSLIP', cx - 38, cy - 22, { width: 76, align: 'center' });
  doc.fontSize(9).text(companyName, cx - 38, cy - 6, { width: 76, align: 'center' });
  doc.fontSize(7).text('AUTHORIZED', cx - 38, cy + 12, { width: 76, align: 'center' });
  doc.fontSize(6).text(new Date().toLocaleDateString(), cx - 38, cy + 24, { width: 76, align: 'center' });
  doc.restore();
}

function row(doc, label, value, y, options = {}) {
  const { bold = false, color = '#111827' } = options;
  doc.fontSize(10).fillColor('#6b7280').text(label, 50, y);
  doc.fontSize(bold ? 12 : 10).fillColor(color).text(value, 280, y, { align: 'right', width: 265 });
  return y + (bold ? 22 : 18);
}

async function generatePayslipPdf(payroll, options = {}) {
  const { stamped = false } = options;
  const companyName = getCompanyName();
  const employee = payroll.employee || {};
  const user = employee.user || {};
  const period = `${MONTHS[payroll.month - 1]} ${payroll.year}`;

  const totalAllowances = Object.values(payroll.allowances || {}).reduce((s, v) => s + (v || 0), 0);
  const totalDeductions = Object.values(payroll.deductions || {}).reduce((s, v) => s + (v || 0), 0);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (stamped) {
      drawWatermark(doc, companyName);
    }

    doc.fontSize(22).fillColor('#1e3a8a').text(companyName, { align: 'center' });
    doc.fontSize(14).fillColor('#374151').text('Employee Payslip', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#6b7280').text(period, { align: 'center' });
    doc.moveDown(1.2);

    doc.fontSize(12).fillColor('#111827').text('Employee Details', { underline: true });
    doc.moveDown(0.5);
    let y = doc.y;
    y = row(doc, 'Name', user.name || 'N/A', y);
    y = row(doc, 'Email', user.email || 'N/A', y);
    y = row(doc, 'Position', employee.position || 'N/A', y);
    y = row(doc, 'Department', employee.department?.name || 'N/A', y);
    y = row(doc, 'Employee ID', employee.employeeId || String(employee._id || 'N/A'), y);
    y = row(doc, 'Status', (payroll.status || 'pending').toUpperCase(), y);

    doc.y = y + 10;
    doc.fontSize(12).fillColor('#111827').text('Earnings', { underline: true });
    doc.moveDown(0.5);
    y = doc.y;
    y = row(doc, 'Base Salary', formatCurrency(payroll.baseSalary), y);
    y = row(doc, 'Housing Allowance', formatCurrency(payroll.allowances?.housing), y);
    y = row(doc, 'Transport Allowance', formatCurrency(payroll.allowances?.transport), y);
    y = row(doc, 'Medical Allowance', formatCurrency(payroll.allowances?.medical), y);
    y = row(doc, 'Other Allowances', formatCurrency(payroll.allowances?.other), y);
    if (payroll.overtime?.amount > 0) {
      y = row(doc, 'Overtime', formatCurrency(payroll.overtime.amount), y);
    }
    if (payroll.bonus > 0) {
      y = row(doc, 'Bonus', formatCurrency(payroll.bonus), y);
    }
    y = row(doc, 'Gross Salary', formatCurrency(payroll.grossSalary), y, { bold: true, color: '#059669' });

    doc.y = y + 10;
    doc.fontSize(12).fillColor('#111827').text('Deductions', { underline: true });
    doc.moveDown(0.5);
    y = doc.y;
    y = row(doc, 'Tax', formatCurrency(payroll.deductions?.tax), y);
    y = row(doc, 'Insurance', formatCurrency(payroll.deductions?.insurance), y);
    y = row(doc, 'Provident Fund', formatCurrency(payroll.deductions?.providentFund), y);
    y = row(doc, 'Other Deductions', formatCurrency(payroll.deductions?.other), y);
    y = row(doc, 'Total Deductions', formatCurrency(totalDeductions), y, { color: '#dc2626' });

    doc.y = y + 14;
    doc.rect(50, doc.y, 495, 36).fill('#eff6ff');
    row(doc, 'Net Salary (Take Home)', formatCurrency(payroll.netSalary), doc.y + 10, {
      bold: true,
      color: '#1d4ed8'
    });

    doc.moveDown(2);
    if (payroll.approvedBy?.name) {
      doc.fontSize(9).fillColor('#6b7280').text(`Approved by: ${payroll.approvedBy.name}`);
    }
    if (payroll.paymentDate) {
      doc.fontSize(9).fillColor('#6b7280').text(`Payment date: ${new Date(payroll.paymentDate).toLocaleDateString()}`);
    }
    doc.fontSize(8).fillColor('#9ca3af').text(
      `Generated on ${new Date().toLocaleString()} · Confidential`,
      50,
      doc.page.height - 50,
      { align: 'center', width: doc.page.width - 100 }
    );

    if (stamped) {
      drawCompanyStamp(doc, companyName);
    }

    doc.end();
  });
}

module.exports = { generatePayslipPdf, getCompanyName };
