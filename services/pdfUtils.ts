import { CompanyProfile } from '../types';

export function getCompanyHeaderHtml(companyProfile: CompanyProfile | null): string {
  const logoHtml = companyProfile?.companyLogo
    ? `<img src="data:image/png;base64,${companyProfile.companyLogo}" style="height:50px; width:auto; border-radius:4px;" />`
    : `<div style="height:50px; width:50px; background-color:#e2e8f0; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:9px; color:#4a5568;">No Logo</div>`;

  // Using a table for layout as it's more robust in jspdf's HTML renderer
  return `
    <div style="font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #374151; width: 100%;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 60px; vertical-align: top;">
            ${logoHtml}
          </td>
          <td style="padding-left: 15px; vertical-align: top;">
            <div style="font-size: 14pt; font-weight: bold; color: #111827;">${companyProfile?.companyName || "Company Name"}</div>
            <div style="margin-top: 4px;">${companyProfile?.address || ""}</div>
            <div style="color: #2563eb;">${companyProfile?.website || ""}</div>
          </td>
          <td style="text-align: right; vertical-align: top; font-size: 8pt;">
            <strong>Primary Contact</strong><br/>
            ${companyProfile?.primaryContactName || ""}<br/>
            ${companyProfile?.primaryContactEmail || ""}<br/>
            ${companyProfile?.primaryContactPhone || ""}
          </td>
        </tr>
      </table>
      <div style="border-bottom: 1px solid #d1d5db; margin-top: 15px; margin-bottom: 20px;"></div>
    </div>
  `;
}
