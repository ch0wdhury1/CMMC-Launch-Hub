interface SolutionItem {
  title: string;
  description?: string;
  practices: string[];
  buttons: Array<{
    label: string;
    action?: () => void;
    variant: 'primary' | 'secondary';
  }>;
}

export const CLOUD_SOLUTIONS: SolutionItem[] = [
  {
    title: "Microsoft 365 Business Premium",
    description: "An integrated solution bringing together best-in-class productivity apps with advanced security and device management.",
    practices: ["AC.L1-3.1.1", "IA.L1-3.5.1", "IA.L1-3.5.2", "SC.L1-3.13.1", "SI.L1-3.14.2"],
    buttons: [{ label: "View Details", variant: "primary" }],
  },
  {
    title: "Microsoft 365 GCC",
    description: "A cloud suite designed for US government contractors, offering enhanced compliance features for handling CUI.",
    practices: ["AC.L1-3.1.1", "AC.L1-3.1.20", "IA.L1-3.5.2", "SC.L1-3.13.1", "SI.L1-3.14.1"],
    buttons: [{ label: "View Details", variant: "primary" }],
  },
  {
    title: "Google Workspace Enterprise",
    description: "Provides enterprise-grade access control, data protection, and endpoint management for secure collaboration.",
    practices: ["AC.L1-3.1.1", "IA.L1-3.5.2", "SC.L1-3.13.1", "SI.L1-3.14.2"],
    buttons: [{ label: "View Details", variant: "primary" }],
  },
   {
    title: "NordLayer (Business VPN)",
    description: "A secure network access solution that protects external connections and helps enforce boundary protection.",
    practices: ["AC.L1-3.1.20", "SC.L1-3.13.1"],
    buttons: [{ label: "View Details", variant: "primary" }],
  },
];

export const POLICIES_PROCEDURES: SolutionItem[] = [
  {
    title: "Access Control Policy",
    practices: ["AC.L1-3.1.1", "AC.L1-3.1.2"],
    buttons: [
      { label: "View Template", variant: "secondary" },
      { label: "Download PDF", variant: "primary" },
    ],
  },
  {
    title: "Account Management Procedure",
    practices: ["AC.L1-3.1.1", "IA.L1-3.5.1", "IA.L1-3.5.2"],
    buttons: [
      { label: "View Template", variant: "secondary" },
      { label: "Download PDF", variant: "primary" },
    ],
  },
  {
    title: "Media Sanitization Procedure",
    practices: ["MP.L1-3.8.3"],
    buttons: [
      { label: "View Template", variant: "secondary" },
      { label: "Download PDF", variant: "primary" },
    ],
  },
  {
    title: "Visitor Access Policy",
    practices: ["PE.L1-3.10.3"],
    buttons: [
      { label: "View Template", variant: "secondary" },
      { label: "Download PDF", variant: "primary" },
    ],
  },
  {
    title: "Incident Reporting Procedure",
    practices: ["SI.L1-3.14.2"],
    buttons: [
      { label: "View Template", variant: "secondary" },
      { label: "Download PDF", variant: "primary" },
    ],
  },
    {
    title: "Physical Security Procedure",
    practices: ["PE.L1-3.10.1", "PE.L1-3.10.5"],
    buttons: [
      { label: "View Template", variant: "secondary" },
      { label: "Download PDF", variant: "primary" },
    ],
  },
];

export const ESSENTIAL_TOOLS: SolutionItem[] = [
  {
    title: "Antivirus / Endpoint Protection",
    description: "Software that detects, prevents, and removes malicious software on workstations and servers.",
    practices: ["SI.L1-3.14.2", "SI.L1-3.14.4", "SI.L1-3.14.5"],
    buttons: [{ label: "Recommended Options", variant: "primary" }],
  },
  {
    title: "Smart Door Lock",
    description: "Electronic locks that provide auditable access control for server rooms or sensitive areas.",
    practices: ["PE.L1-3.10.1", "PE.L1-3.10.4", "PE.L1-3.10.5"],
    buttons: [{ label: "Recommended Options", variant: "primary" }],
  },
  {
    title: "Surveillance Camera",
    description: "Cameras that monitor physical access to facilities, helping to meet visitor monitoring requirements.",
    practices: ["PE.L1-3.10.3"],
    buttons: [{ label: "Recommended Options", variant: "primary" }],
  },
  {
    title: "Encrypted USB Drives",
    description: "Portable storage with built-in hardware encryption to protect data if the device is lost or stolen.",
    practices: ["MP.L1-3.8.3"],
    buttons: [{ label: "Recommended Options", variant: "primary" }],
  },
  {
    title: "Password Manager",
    description: "A tool to securely store and generate complex passwords, supporting authentication best practices.",
    practices: ["IA.L1-3.5.2"],
    buttons: [{ label: "Recommended Options", variant: "primary" }],
  },
   {
    title: "Business VPN",
    description: "A Virtual Private Network encrypts internet traffic, securing external connections.",
    practices: ["AC.L1-3.1.20", "SC.L1-3.13.1"],
    buttons: [{ label: "Recommended Options", variant: "primary" }],
  },
];