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

const contactName = (companyProfile: CompanyProfile | null | undefined, contact: "primary" | "secondary") =>
  (companyProfile as any)?.contacts?.[contact]?.name
  || (contact === "primary" ? companyProfile?.primaryContactName : companyProfile?.secondaryContactName);

const contactEmail = (companyProfile: CompanyProfile | null | undefined, contact: "primary" | "secondary") =>
  (companyProfile as any)?.contacts?.[contact]?.email
  || (contact === "primary" ? companyProfile?.primaryContactEmail : companyProfile?.secondaryContactEmail);

const contactPhone = (companyProfile: CompanyProfile | null | undefined, contact: "primary" | "secondary") =>
  (companyProfile as any)?.contacts?.[contact]?.phone
  || (contact === "primary" ? companyProfile?.primaryContactPhone : companyProfile?.secondaryContactPhone);

const addressText = (address: unknown) => {
  if (!address || typeof address === 'string') return address;
  const value = address as { street?: string; city?: string; state?: string; zip?: string; country?: string };
  return [value.street, value.city, value.state, value.zip, value.country].filter(Boolean).join(', ');
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
  const orgName = companyName(companyProfile, profile.organizationName || 'Organization name not provided');
  const cmmcProfile = (companyProfile as any)?.cmmc || {};
  const scopeProfile = (companyProfile as any)?.scope || {};
  const providers = (companyProfile as any)?.providers || {};
  const headquarters = scopeProfile.headquarters || addressText(companyProfile?.address);

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
    ['Primary Contact', `${notProvided(contactName(companyProfile, 'primary') || profile.contactName)} | ${notProvided(contactEmail(companyProfile, 'primary') || profile.contactEmail)}`],
    ['Company Address', headquarters],
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
    ['Legal Name', (companyProfile as any)?.legalName || companyProfile?.companyName || profile.organizationName],
    ['DBA / Display Name', (companyProfile as any)?.dbaName],
    ['CAGE', (companyProfile as any)?.cageCode],
    ['UEI', (companyProfile as any)?.uei],
    ['DUNS', (companyProfile as any)?.duns],
    ['NAICS', (companyProfile as any)?.naicsCodes || (companyProfile as any)?.naics],
    ['Primary Contact', contactName(companyProfile, 'primary') || profile.contactName],
    ['Phone', contactPhone(companyProfile, 'primary')],
    ['Email', contactEmail(companyProfile, 'primary') || profile.contactEmail],
    ['Secondary Contact', contactName(companyProfile, 'secondary')],
    ['Secondary Contact Email', contactEmail(companyProfile, 'secondary')],
    ['Website', companyProfile?.website],
    ['Address', headquarters],
  ], margin);

  y = sectionTitle(doc, 'Policies and Procedures Identified', y + 2, margin);
  addWrappedParagraph(doc, policies.length > 0 ? policies.join(', ') : 'No formal policies have been identified as active.', y, margin, 9);

  // Page 3: system and assessment scope
  doc.addPage();
  drawCompanyHeader(doc, companyProfile, 'Assessment Scope', margin);
  y = sectionTitle(doc, 'System / Assessment Scope', 52, margin);
  y = keyValueTable(doc, y, [
    ['Assessment Level', cmmcProfile.assessmentLevel || cmmcLevel],
    ['System Name', cmmcProfile.systemName || profile.systemName],
    ['System Description', cmmcProfile.systemDescription || profile.systemDescription],
    ['Scope Notes', cmmcProfile.systemBoundarySummary || profile.scopeNotes],
    ['Handles FCI', cmmcProfile.handlesFCI || (answers as any).handlesFci || (answers as any).fci || 'Not provided'],
    ['Handles CUI', cmmcProfile.handlesCUI || (answers as any).handlesCui || (answers as any).cui || 'Not provided'],
    ['Cloud Platform', providers.cloudProvider || cmmcProfile.cloudProviders || (answers as any).cloudPlatform],
    ['Boundary Notes', cmmcProfile.systemBoundarySummary || (answers as any).boundaryNotes || profile.scopeNotes],
    ['Headquarters', headquarters],
    ['Additional Locations', scopeProfile.additionalLocations || (answers as any).locations || (answers as any).facilityLocations],
    ['Employee Count', cmmcProfile.employeeCount],
    ['User Count', cmmcProfile.userCount],
    ['Location Count', cmmcProfile.locationCount],
    ['Remote Workers', (answers as any).remoteWorkerCount],
    ['VPN for Remote Access', (answers as any).vpnForRemote],
    ['Business Firewall', (answers as any).businessFirewall],
    ['MSP / MSSP Used', cmmcProfile.mspMsspUsed],
    ['MSP / MSSP Name', cmmcProfile.mspMsspName || providers.msp || providers.mssp || (answers as any).mspName || (answers as any).msspName],
    ['Email Provider', providers.emailProvider],
    ['Backup Provider', providers.backupProvider],
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
