import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Practice, PracticeRecord, ReadinessAnswers, ReadinessScores, CompanyProfile, ResponsibilityMatrixEntry } from '../types';
import { SystemProfile } from '../hooks/useSspData';
import {
  addReportFooter,
  addWrappedParagraph,
  cleanFilePart,
  companyName,
  drawCompanyHeader,
  keyValueTable,
  notProvided,
  reportColors,
  sectionTitle,
} from './reportPdfUtils';

interface SspPdfInput {
  profile: SystemProfile;
  scores: ReadinessScores;
  answers: ReadinessAnswers;
  practices: Practice[];
  records: PracticeRecord[];
  policies: string[];
  companyProfile: CompanyProfile | null;
  responsibilityMatrix: ResponsibilityMatrixEntry[];
}

const formatStatus = (status?: string) => notProvided(status).replace(/_/g, ' ').toUpperCase();

const evidenceCount = (record?: PracticeRecord) => {
  if (!record) return 0;
  return Object.values(record.objectiveRecords || {})
    .reduce((total, objective) => total + (objective.artifacts || []).filter(item => !item.archived).length, 0);
};

const responsibilityText = (
  practice: Practice,
  responsibilityMatrix: ResponsibilityMatrixEntry[],
  companyProfile: CompanyProfile | null
) => {
  const entry = responsibilityMatrix.find(item => item.practiceId === practice.id);
  if (!entry) return 'Responsibility not assigned.';
  const orgName = companyName(companyProfile, 'the organization');
  if (entry.responsibility === 'provider') return `Provider: ${notProvided(entry.providerName)}. ${orgName} remains responsible for oversight.`;
  if (entry.responsibility === 'shared') return `Shared between ${orgName} and ${notProvided(entry.providerName)}. Internal owner: ${notProvided(entry.internalOwner)}.`;
  return `Customer responsibility. Internal owner: ${notProvided(entry.internalOwner)}.`;
};

export const generateSspPdf = async ({
  profile,
  scores,
  answers,
  practices,
  records,
  policies,
  companyProfile,
  responsibilityMatrix,
}: SspPdfInput) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const margin = 15;
  const generatedAt = new Date();
  const recordMap = new Map(records.map(record => [record.id, record]));
  const cmmcLevel = practices.some(practice => practice.level === 2) ? 'CMMC Level 2' : 'CMMC Level 1';
  const assessmentName = profile.systemName || 'Current Assessment';
  const orgName = companyProfile?.companyName || profile.organizationName || 'Organization name not provided';

  // Page 1: cover and summary
  drawCompanyHeader(doc, companyProfile, 'System Security Plan', margin);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...reportColors.navy);
  doc.text('CMMC Launch Hub', margin, 58);
  doc.setFontSize(20);
  doc.text('System Security Plan', margin, 70);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...reportColors.muted);
  doc.text(`Generated ${generatedAt.toLocaleString()}`, margin, 79);

  keyValueTable(doc, 92, [
    ['Organization Name', orgName],
    ['Assessment Name', assessmentName],
    ['CMMC Level', cmmcLevel],
    ['Primary Contact', `${notProvided(profile.contactName)} | ${notProvided(profile.contactEmail)}`],
    ['Company Address', companyProfile?.address],
    ['Website', companyProfile?.website],
    ['Prepared By', 'CMMC Launch Hub'],
  ], margin);

  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 158) + 8,
    head: [['Overall Readiness', 'Practice Completion', 'Controls Posture']],
    body: [[`${scores.overallReadinessScore}%`, `${scores.practiceCompletionScore}%`, `${scores.controlsPostureScore}%`]],
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: { fontSize: 11, cellPadding: 4, halign: 'center' },
    headStyles: { fillColor: reportColors.blue, halign: 'center' },
    bodyStyles: { fontStyle: 'bold' },
  });

  addWrappedParagraph(
    doc,
    'This document is generated from organization-provided assessment and profile data and should be reviewed before external submission.',
    ((doc as any).lastAutoTable?.finalY || 188) + 12,
    margin,
    9.5
  );

  // Page 2: organization profile
  doc.addPage();
  drawCompanyHeader(doc, companyProfile, 'Organization Profile', margin);
  let y = sectionTitle(doc, 'Organization Profile', 52, margin);
  y = keyValueTable(doc, y, [
    ['Legal Name', companyProfile?.companyName || profile.organizationName],
    ['DBA / Display Name', companyProfile?.companyName],
    ['CAGE', (companyProfile as any)?.cageCode],
    ['UEI', (companyProfile as any)?.uei],
    ['NAICS', (companyProfile as any)?.naics],
    ['Primary Contact', profile.contactName || companyProfile?.primaryContactName],
    ['Phone', companyProfile?.primaryContactPhone],
    ['Email', profile.contactEmail || companyProfile?.primaryContactEmail],
    ['Website', companyProfile?.website],
    ['Address', companyProfile?.address],
  ], margin);

  y = sectionTitle(doc, 'Policies and Procedures Identified', y + 2, margin);
  addWrappedParagraph(doc, policies.length > 0 ? policies.join(', ') : 'No formal policies have been identified as active.', y, margin, 9);

  // Page 3: system and assessment scope
  doc.addPage();
  drawCompanyHeader(doc, companyProfile, 'Assessment Scope', margin);
  y = sectionTitle(doc, 'System / Assessment Scope', 52, margin);
  y = keyValueTable(doc, y, [
    ['Assessment Level', cmmcLevel],
    ['System Name', profile.systemName],
    ['System Description', profile.systemDescription],
    ['Scope Notes', profile.scopeNotes],
    ['Handles FCI', (answers as any).handlesFci || (answers as any).fci || 'Not provided'],
    ['Handles CUI', (answers as any).handlesCui || (answers as any).cui || 'Not provided'],
    ['Cloud Platform', (answers as any).cloudPlatform],
    ['Boundary Notes', (answers as any).boundaryNotes || profile.scopeNotes],
    ['Locations', (answers as any).locations || (answers as any).facilityLocations],
    ['Remote Workers', (answers as any).remoteWorkerCount],
    ['VPN for Remote Access', (answers as any).vpnForRemote],
    ['Business Firewall', (answers as any).businessFirewall],
    ['MSP / MSSP', (answers as any).mspName || (answers as any).msspName],
  ], margin);

  y = sectionTitle(doc, 'Scope Narrative', y + 2, margin);
  addWrappedParagraph(
    doc,
    'The assessment scope is based on the organization profile and readiness data captured in CMMC Launch Hub. Missing fields are intentionally shown as "Not provided" so they can be reviewed and completed before external use.',
    y,
    margin,
    9
  );

  // Practice and objective detail: landscape table section
  doc.addPage('letter', 'landscape');
  drawCompanyHeader(doc, companyProfile, 'Practice Detail', margin);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...reportColors.navy);
  doc.text('Practice / Objective Detail', margin, 52);

  const practiceRows = practices.map(practice => {
    const record = recordMap.get(practice.id);
    const objectives = practice.assessment_objectives.length > 0
      ? practice.assessment_objectives.map(objective => {
        const objectiveRecord = record?.objectiveRecords?.[objective.id];
        const status = formatStatus(objectiveRecord?.status || objective.status);
        const note = objectiveRecord?.note || objective.note;
        return `- ${objective.id} (${status}): ${objective.text}${note ? `\n  Note: ${note}` : ''}`;
      }).join('\n')
      : 'No assessment objectives provided.';

    return {
      practice: `${practice.id}\n${practice.name}`,
      domain: practice.domainName,
      status: formatStatus(record?.status),
      assignee: record?.assignedToName || record?.assignedToEmail || 'Unassigned',
      notes: record?.note || 'Not provided',
      evidence: String(evidenceCount(record)),
      responsibility: responsibilityText(practice, responsibilityMatrix, companyProfile),
      objectives,
    };
  });

  autoTable(doc, {
    startY: 60,
    head: [['Practice', 'Domain', 'Status', 'Assignee', 'Evidence', 'Responsibility']],
    body: practiceRows.map(row => [row.practice, row.domain, row.status, row.assignee, row.evidence, row.responsibility]),
    theme: 'striped',
    margin: { top: 42, left: margin, right: margin, bottom: 18 },
    styles: { fontSize: 7.5, cellPadding: 1.8, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: reportColors.blue, fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 36 },
      2: { cellWidth: 22 },
      3: { cellWidth: 34 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 84 },
    },
    didDrawPage: () => {
      if (doc.getCurrentPageInfo().pageNumber > 4) drawCompanyHeader(doc, companyProfile, 'Practice Detail', margin);
    },
  });

  const summaryFinalY = (doc as any).lastAutoTable.finalY || 60;
  let detailStartY = summaryFinalY + 10;
  if (detailStartY > 160) {
    doc.addPage('letter', 'landscape');
    drawCompanyHeader(doc, companyProfile, 'Practice Detail', margin);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...reportColors.navy);
    doc.text('Practice / Objective Detail', margin, 52);
    detailStartY = 60;
  }

  autoTable(doc, {
    startY: detailStartY,
    head: [['Practice', 'Assessment Objectives', 'Implementation Notes']],
    body: practiceRows.map(row => [row.practice, row.objectives, row.notes]),
    theme: 'grid',
    margin: { top: 42, left: margin, right: margin, bottom: 18 },
    styles: { fontSize: 7.4, cellPadding: 1.8, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: reportColors.blue, fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 125 },
      2: { cellWidth: 76 },
    },
    didDrawPage: () => {
      if (doc.getCurrentPageInfo().pageNumber > 4) drawCompanyHeader(doc, companyProfile, 'Practice Detail', margin);
    },
  });

  addReportFooter(doc, 'CMMC Launch Hub — System Security Plan |', margin);
  doc.save(`SSP_${cleanFilePart(orgName)}_${generatedAt.toISOString().split('T')[0]}.pdf`);
};
