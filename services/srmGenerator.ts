import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ResponsibilityMatrixEntry, CompanyProfile } from '../types';
import { addReportFooter, cleanFilePart, companyName, drawCompanyHeader, reportColors } from './reportPdfUtils';

interface SrmPdfInput {
  matrix: ResponsibilityMatrixEntry[];
  companyProfile: CompanyProfile | null;
}

export const generateSrmPdf = async ({ matrix, companyProfile }: SrmPdfInput) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const margin = 12;

  drawCompanyHeader(doc, companyProfile, 'Shared Responsibility Matrix', margin);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...reportColors.blue);
  doc.text('Shared Responsibility Matrix (SRM)', margin, 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...reportColors.text);
  doc.text(
    'This matrix outlines responsibility for CMMC practices between the customer organization and service providers.',
    margin,
    60,
    { maxWidth: doc.internal.pageSize.getWidth() - margin * 2 }
  );

  const tableBody = matrix.map(item => [
    item.practiceId,
    item.practiceName,
    item.responsibility,
    item.providerName || 'Not provided',
    item.internalOwner || 'Not provided',
    item.notes || 'Not provided',
  ]);

  autoTable(doc, {
    startY: 70,
    head: [['Practice ID', 'Practice Name', 'Responsibility', 'Provider', 'Internal Owner', 'Notes']],
    body: tableBody,
    theme: 'striped',
    margin: { top: 42, left: margin, right: margin, bottom: 15 },
    styles: { fontSize: 7.2, cellPadding: 1.8, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: reportColors.blue },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 62 },
      2: { cellWidth: 32 },
      3: { cellWidth: 42 },
      4: { cellWidth: 42 },
      5: { cellWidth: 68 },
    },
    didDrawPage: () => {
      if (doc.getCurrentPageInfo().pageNumber > 1) drawCompanyHeader(doc, companyProfile, 'Shared Responsibility Matrix', margin);
    },
  });

  addReportFooter(doc, 'CMMC Launch Hub — Shared Responsibility Matrix', margin);
  doc.save(`SRM_${cleanFilePart(companyName(companyProfile, 'Report'))}_${new Date().toISOString().split('T')[0]}.pdf`);
};
