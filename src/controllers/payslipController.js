const PDFDocument = require('pdfkit');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const User = require('../models/User');

/**
 * Generate a PDF payslip for a specific payroll record
 */
const generatePayslipPDF = async (req, res) => {
  try {
    const payrollId = req.params.id;
    console.log(`🔍 Generating payslip PDF for payroll ID: ${payrollId}`);
    
    // Find the payroll record and populate employee and approver details
    const payroll = await Payroll.findById(payrollId)
      .populate({
        path: 'employee',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate('approvedBy', 'name email');
    
    if (!payroll) {
      console.error(`❌ Payroll record not found: ${payrollId}`);
      return res.status(404).json({ message: 'Payroll record not found' });
    }
    
    // Check if payroll is approved or paid
    if (payroll.status === 'pending') {
      console.error(`❌ Cannot generate payslip for pending payroll: ${payrollId}`);
      return res.status(400).json({ message: 'Cannot generate payslip for pending payroll' });
    }
    
    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers for PDF download
    const fileName = `payslip-${payroll.employee.user.name.replace(/\s+/g, '-').toLowerCase()}-${payroll.month}-${payroll.year}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Pipe the PDF to the response
    doc.pipe(res);
    
    // Get month name
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = months[payroll.month - 1];
    
    // Format currency
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    };
    
    // Add company header
    doc.fontSize(20).text('HR Management System', { align: 'center' });
    doc.fontSize(16).text('PAYSLIP', { align: 'center' });
    doc.moveDown();
    
    // Add payroll period
    doc.fontSize(12).text(`Pay Period: ${monthName} ${payroll.year}`, { align: 'center' });
    doc.moveDown();
    
    // Add employee information
    doc.fontSize(14).text('Employee Information', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Name: ${payroll.employee.user.name}`);
    doc.text(`Email: ${payroll.employee.user.email}`);
    doc.text(`Status: ${payroll.status.toUpperCase()}`);
    if (payroll.status === 'paid' && payroll.paymentDate) {
      doc.text(`Payment Date: ${new Date(payroll.paymentDate).toLocaleDateString()}`);
    }
    doc.moveDown();
    
    // Add salary details
    doc.fontSize(14).text('Salary Details', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    
    // Base salary
    doc.text(`Base Salary: ${formatCurrency(payroll.baseSalary)}`);
    doc.moveDown(0.5);
    
    // Allowances
    doc.text('Allowances:', { continued: true });
    doc.text(`${formatCurrency(Object.values(payroll.allowances).reduce((sum, val) => sum + val, 0))}`, { align: 'right' });
    
    if (payroll.allowances.housing > 0) {
      doc.text('  Housing Allowance:', { continued: true });
      doc.text(`${formatCurrency(payroll.allowances.housing)}`, { align: 'right' });
    }
    
    if (payroll.allowances.transport > 0) {
      doc.text('  Transport Allowance:', { continued: true });
      doc.text(`${formatCurrency(payroll.allowances.transport)}`, { align: 'right' });
    }
    
    if (payroll.allowances.medical > 0) {
      doc.text('  Medical Allowance:', { continued: true });
      doc.text(`${formatCurrency(payroll.allowances.medical)}`, { align: 'right' });
    }
    
    if (payroll.allowances.other > 0) {
      doc.text('  Other Allowances:', { continued: true });
      doc.text(`${formatCurrency(payroll.allowances.other)}`, { align: 'right' });
    }
    
    doc.moveDown(0.5);
    
    // Overtime
    if (payroll.overtime.hours > 0) {
      doc.text(`Overtime (${payroll.overtime.hours} hours @ ${formatCurrency(payroll.overtime.rate)}/hr):`, { continued: true });
      doc.text(`${formatCurrency(payroll.overtime.amount)}`, { align: 'right' });
    }
    
    // Bonus
    if (payroll.bonus > 0) {
      doc.text('Bonus:', { continued: true });
      doc.text(`${formatCurrency(payroll.bonus)}`, { align: 'right' });
    }
    
    doc.moveDown(0.5);
    
    // Gross salary
    doc.fontSize(12);
    doc.text('Gross Salary:', { continued: true });
    doc.text(`${formatCurrency(payroll.grossSalary)}`, { align: 'right' });
    doc.moveDown();
    
    // Deductions
    doc.fontSize(10);
    doc.text('Deductions:', { continued: true });
    doc.text(`${formatCurrency(Object.values(payroll.deductions).reduce((sum, val) => sum + val, 0))}`, { align: 'right' });
    
    if (payroll.deductions.tax > 0) {
      doc.text('  Tax:', { continued: true });
      doc.text(`${formatCurrency(payroll.deductions.tax)}`, { align: 'right' });
    }
    
    if (payroll.deductions.insurance > 0) {
      doc.text('  Insurance:', { continued: true });
      doc.text(`${formatCurrency(payroll.deductions.insurance)}`, { align: 'right' });
    }
    
    if (payroll.deductions.providentFund > 0) {
      doc.text('  Provident Fund:', { continued: true });
      doc.text(`${formatCurrency(payroll.deductions.providentFund)}`, { align: 'right' });
    }
    
    if (payroll.deductions.other > 0) {
      doc.text('  Other Deductions:', { continued: true });
      doc.text(`${formatCurrency(payroll.deductions.other)}`, { align: 'right' });
    }
    
    doc.moveDown();
    
    // Net salary
    doc.fontSize(14);
    doc.text('Net Salary:', { continued: true });
    doc.text(`${formatCurrency(payroll.netSalary)}`, { align: 'right' });
    
    // Add notes if any
    if (payroll.notes) {
      doc.moveDown(2);
      doc.fontSize(10);
      doc.text('Notes:', { underline: true });
      doc.text(payroll.notes);
    }
    
    // Add footer
    doc.moveDown(2);
    doc.fontSize(8);
    doc.text('This is a computer-generated document. No signature is required.', { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    
    // Finalize the PDF
    doc.end();
    
    console.log(`✅ Payslip PDF generated successfully for payroll ID: ${payrollId}`);
  } catch (error) {
    console.error('❌ Error generating payslip PDF:', error);
    res.status(500).json({ 
      message: 'Failed to generate payslip PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  generatePayslipPDF
};