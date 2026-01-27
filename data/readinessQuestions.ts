interface Question {
  id: string;
  label: string;
  type: 'yes_no' | 'yes_no_partial' | 'yes_no_some' | 'numeric' | 'it_support' | 'cloud_platform' | 'checkbox';
  options?: string[]; // For checkbox type
}

interface Section {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

export const READINESS_QUESTIONS: Section[] = [
  {
    id: 'orgProfile',
    title: 'A — Organization Profile',
    description: 'Basic information about your company.',
    questions: [
      { id: 'processesFci', label: 'Do you store or process Federal Contract Information (FCI)?', type: 'yes_no_partial' },
      { id: 'processesCui', label: 'Do you store or process Controlled Unclassified Information (CUI)?', type: 'yes_no' },
      { id: 'employeeCount', label: 'Number of employees', type: 'numeric' },
      { id: 'remoteWorkerCount', label: 'Number of remote workers', type: 'numeric' },
      { id: 'itSupportType', label: 'IT support type', type: 'it_support' },
    ],
  },
  {
    id: 'userAccess',
    title: 'B — User & Access Control',
    description: 'How users are identified and authenticated.',
    questions: [
      { id: 'uniqueLogins', label: 'Is every user provided a unique login/username?', type: 'yes_no_partial' },
      { id: 'mfaEnabled', label: 'Is Multi-Factor Authentication (MFA) enabled on critical systems (e.g., email, admin accounts)?', type: 'yes_no_partial' },
      { id: 'passwordManager', label: 'Does the company use a password manager?', type: 'yes_no_some' },
      { id: 'accountLifecycle', label: 'Is there a formal process for creating/removing user accounts?', type: 'yes_no_partial' },
      { id: 'adminAccounts', label: 'Are administrative accounts restricted to only necessary personnel?', type: 'yes_no_partial' },
    ],
  },
  {
    id: 'deviceSecurity',
    title: 'C — Device Security',
    description: 'How company computers and devices are secured.',
    questions: [
      { id: 'assetInventory', label: 'Is an inventory of all IT assets (laptops, servers) maintained?', type: 'yes_no_some' },
      { id: 'antivirus', label: 'Is antivirus/anti-malware software installed on all computers?', type: 'yes_no_some' },
      { id: 'diskEncryption', label: 'Is full disk encryption enabled on laptops?', type: 'yes_no_some' },
      { id: 'personalDeviceUsage', label: 'Are personal devices (BYOD) used for company work?', type: 'yes_no_some' },
      { id: 'osUpdates', label: 'Are operating system updates automatically installed?', type: 'yes_no_some' },
    ],
  },
  {
    id: 'networkSecurity',
    title: 'D — Network / Firewall / VPN',
    description: 'How your network boundaries are protected.',
    questions: [
      { id: 'businessFirewall', label: 'Is a business-grade firewall in place at the office?', type: 'yes_no_partial' },
      { id: 'vpnForRemote', label: 'Do remote workers use a company VPN to connect to internal resources?', type: 'yes_no_some' },
      { id: 'guestWifi', label: 'Is guest Wi-Fi separate from the internal company network?', type: 'yes_no_partial' },
      { id: 'wifiSecurity', label: 'Is the internal Wi-Fi secured with WPA2 or WPA3 encryption?', type: 'yes_no_partial' },
      { id: 'networkFiltering', label: 'Is network traffic filtering (inbound/outbound) configured on the firewall?', type: 'yes_no_partial' },
    ],
  },
  {
    id: 'cloudEmail',
    title: 'E — Cloud & Email Security',
    description: 'How cloud services and email are configured.',
    questions: [
      { id: 'cloudPlatform', label: 'Primary cloud platform', type: 'cloud_platform' },
      { id: 'cloudMfa', label: 'Is MFA enforced for all users on the cloud platform?', type: 'yes_no_partial' },
      { id: 'emailFiltering', label: 'Is an email filtering service (anti-spam/anti-phishing) enabled?', type: 'yes_no_partial' },
      { id: 'externalSharing', label: 'Are there restrictions on sharing files externally from cloud storage?', type: 'yes_no_partial' },
      { id: 'cloudStorageUsage', label: 'Is a company-managed cloud storage service (e.g., OneDrive, Google Drive) used?', type: 'yes_no_some' },
    ],
  },
  {
    id: 'physicalSecurity',
    title: 'F — Physical Security',
    description: 'How physical access to your facilities and equipment is controlled.',
    questions: [
      { id: 'lockedRooms', label: 'Are server rooms or other sensitive areas kept locked?', type: 'yes_no_some' },
      { id: 'visitorLogs', label: 'Are logs of visitors maintained?', type: 'yes_no_some' },
      { id: 'visitorBadges', label: 'Are visitors escorted or issued badges?', type: 'yes_no_some' },
      { id: 'cameras', label: 'Are cameras monitoring entry points to the facility?', type: 'yes_no_some' },
      { id: 'mediaStorage', label: 'Is sensitive media (e.g., backup drives) stored securely?', type: 'yes_no_partial' },
    ],
  },
  {
    id: 'policies',
    title: 'G — Policies & Procedures',
    description: 'Select the formal, written policies your organization currently has in place.',
    questions: [
      {
        id: 'existingPolicies',
        label: 'Existing Policies',
        type: 'checkbox',
        options: [
          'Access Control Policy',
          'Password Policy',
          'Media Sanitization Procedure',
          'Incident Response Procedure',
          'Physical Security Policy',
          'Remote Access Policy',
          'Acceptable Use Policy',
          'Visitor Management Policy',
        ],
      },
    ],
  },
  {
    id: 'monitoring',
    title: 'H — System Monitoring',
    description: 'How you monitor for and respond to security events.',
    questions: [
      { id: 'systemAlerts', label: 'Do you receive and review system security alerts (e.g., from antivirus, firewall)?', type: 'yes_no_some' },
      { id: 'logReview', label: 'How often are system logs reviewed?', type: 'yes_no_partial' }, // NOTE: Simplified for this tool
      { id: 'siemUsage', label: 'Do you use a Security Information and Event Management (SIEM) tool?', type: 'yes_no_partial' },
    ],
  },
];