import React, { useMemo, useState } from "react";
import {
  BookOpen,
  CircleHelp,
  Compass,
  FileQuestion,
  Headphones,
  Megaphone,
  PlayCircle,
  Search,
} from "lucide-react";

export type HelpSection = "home" | "getting-started" | "user-guide" | "videos" | "faqs" | "support" | "whats-new";

type RoleContext = {
  isSuperAdmin?: boolean;
  isSponsorObserver?: boolean;
};

type HelpProps = RoleContext & {
  onNavigate: (section: HelpSection) => void;
};

const cardClass = "rounded-lg border bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow";
const calloutBase = "rounded-lg border p-4 text-sm";

const screenshot = (label: string) => (
  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm font-semibold text-gray-500">
    [SCREENSHOT:<br />{label}]
  </div>
);

const Callout = ({ type, children }: { type: "NOTE" | "TIP" | "BEST PRACTICE" | "WARNING"; children: React.ReactNode }) => {
  const color = type === "WARNING"
    ? "border-amber-200 bg-amber-50 text-amber-950"
    : type === "BEST PRACTICE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : "border-blue-200 bg-blue-50 text-blue-950";
  return <div className={`${calloutBase} ${color}`}><strong>{type}</strong><div className="mt-1">{children}</div></div>;
};

const helpCards: Array<{ section: HelpSection; title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  { section: "getting-started", title: "Getting Started", description: "Register, log in, complete your profile, start assessment, upload evidence, and generate your first report.", icon: Compass },
  { section: "user-guide", title: "User Guide", description: "Role-aware user guide for organization users, sponsor observers, and SuperAdmins.", icon: BookOpen },
  { section: "videos", title: "Video Tutorials", description: "Training videos and walkthroughs. Coming soon.", icon: PlayCircle },
  { section: "faqs", title: "FAQs", description: "Answers to common questions about registration, assessments, evidence, reporting, marketplace, programs, and support.", icon: FileQuestion },
  { section: "support", title: "Support", description: "Contact support, report issues, and learn how to request help.", icon: Headphones },
  { section: "whats-new", title: "What's New", description: "Recent release highlights and new features.", icon: Megaphone },
];

export const HelpCenterPage: React.FC<HelpProps> = ({ onNavigate }) => {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visibleCards = helpCards.filter(card => !q || `${card.title} ${card.description}`.toLowerCase().includes(q));
  return (
    <div className="space-y-5 pb-8">
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-blue-700">CMMC Launch Hub</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Help Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-700">Find guides, FAQs, support resources, and training materials for CMMC Launch Hub.</p>
        <label className="mt-5 flex max-w-xl items-center rounded-lg border bg-white px-3 py-2">
          <Search className="mr-2 h-4 w-4 text-gray-400" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search Help Center..." className="w-full text-sm outline-none" />
        </label>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleCards.map(card => {
          const Icon = card.icon;
          return (
            <button key={card.section} type="button" onClick={() => onNavigate(card.section)} className={`${cardClass} text-left`}>
              <Icon className="h-6 w-6 text-blue-700" />
              <h2 className="mt-3 text-lg font-bold text-gray-900">{card.title}</h2>
              <p className="mt-2 text-sm text-gray-600">{card.description}</p>
            </button>
          );
        })}
        {!visibleCards.length ? <div className="rounded-lg border bg-white p-5 text-sm text-gray-600">No Help Center cards match your search.</div> : null}
      </section>
    </div>
  );
};

const HelpPageShell = ({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="space-y-5 pb-8">
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      {eyebrow ? <p className="text-xs font-semibold uppercase text-blue-700">{eyebrow}</p> : null}
      <h1 className="mt-1 text-3xl font-bold text-gray-900">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-3xl text-sm text-gray-700">{subtitle}</p> : null}
    </section>
    {children}
  </div>
);

const StepCard = ({ title, children }: { title: string; children: React.ReactNode; key?: React.Key }) => (
  <section className="rounded-lg border bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
    <div className="mt-3 text-sm text-gray-700">{children}</div>
  </section>
);

export const HelpGettingStartedPage: React.FC = () => (
  <HelpPageShell eyebrow="Help Center" title="Getting Started" subtitle="A concise path for new users to become productive in CMMC Launch Hub.">
    <div className="grid gap-4 lg:grid-cols-2">
      {[
        ["Register", "Choose Commercial Subscription or State / Sponsored Program and submit your organization request."],
        ["Wait for Approval", "A platform administrator reviews the request before full access is activated."],
        ["Login", "Use your approved email and password. Use password reset if needed."],
        ["Complete Company Profile", "Add legal name, website, contacts, CAGE, UEI, NAICS, headquarters, locations, and providers."],
        ["Invite Team Members", "OrgAdmins can invite Contributors, Assessors, Viewers, and other admins as appropriate."],
        ["Start Your First Assessment", "Open a CMMC domain, select a practice, review objectives, add notes, set status, and save."],
        ["Upload Evidence", "Upload or attach relevant documents to support practices and objectives."],
        ["Generate First Executive Report", "Use the Executive Readiness Report for a leadership-friendly readiness summary."],
        ["Explore Marketplace", "Search vendors, review profiles, submit reviews where allowed, and track vendor engagement."],
        ["Need Help", "Open Help Center Support or use Send Feedback from any authenticated page."],
      ].map(([title, text]) => <StepCard key={title} title={title}><p>{text}</p>{screenshot(title)}</StepCard>)}
    </div>
    <Callout type="BEST PRACTICE">Complete Company Profile before generating reports. Report quality depends on source data.</Callout>
  </HelpPageShell>
);

const SectionList = ({ sections }: { sections: string[] }) => (
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
    {sections.map(section => (
      <div key={section} className="rounded-lg border bg-white p-4 shadow-sm">
        <h3 className="font-bold text-gray-900">{section}</h3>
        <p className="mt-2 text-sm text-gray-600">Open this topic in the full guide when downloadable docs are published.</p>
      </div>
    ))}
  </div>
);

export const HelpUserGuidePage: React.FC<RoleContext> = ({ isSuperAdmin, isSponsorObserver }) => {
  const guide = isSuperAdmin
    ? {
        title: "SuperAdmin Operations Guide",
        subtitle: "Operational guidance for platform administrators and support staff.",
        sections: ["Dashboard", "Pending Actions", "Active Orgs", "Organization Detail", "Programs", "Sponsor Observers", "Program Analytics", "Marketplace Admin", "Reviews Moderation", "System Health", "Security Model"],
      }
    : isSponsorObserver
      ? {
          title: "Sponsor / Program Observer Guide",
          subtitle: "Read-only oversight guidance for sponsors and program observers.",
          sections: ["Dashboard", "Participants", "Participant Detail", "Program Analytics", "Marketplace", "Security Boundaries", "Troubleshooting"],
        }
      : {
          title: "Organization User Guide",
          subtitle: "Role-aware guidance for OrgAdmins, Contributors, Assessors, and Viewers.",
          sections: ["Dashboard", "Company Profile", "Assessments", "Evidence Library", "Reports", "User Management", "Marketplace", "Vendor Engagement", "AI Features", "Troubleshooting"],
        };
  return (
    <HelpPageShell eyebrow="Help Center" title={guide.title} subtitle={guide.subtitle}>
      <Callout type="NOTE">Full downloadable PDF/Docs version will be added later.</Callout>
      <SectionList sections={guide.sections} />
    </HelpPageShell>
  );
};

export const HelpVideosPage: React.FC = () => (
  <HelpPageShell eyebrow="Help Center" title="Video Tutorials" subtitle="Coming Soon">
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">Planned tutorials</h2>
      <ul className="mt-4 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
        {["Registration and Login", "Company Profile Setup", "Completing Your First Assessment", "Uploading Evidence", "Generating Reports", "Using Marketplace", "Vendor Engagement Tracking", "Sponsor Dashboard Overview", "Program Analytics", "SuperAdmin Operations"].map(item => <li key={item} className="rounded border bg-gray-50 px-3 py-2">{item}</li>)}
      </ul>
    </section>
  </HelpPageShell>
);

const faqSeed = [
  ["Registration & Login", "How do I register as a commercial organization?", "Choose Commercial Subscription, complete company and user fields, select level, and submit for approval."],
  ["Registration & Login", "How do I register for a sponsored program?", "Choose State / Sponsored Program, select the active program, complete user fields, and submit."],
  ["Registration & Login", "Why is my registration pending?", "A platform administrator must approve registrations before full access is activated."],
  ["Registration & Login", "What if my sponsored program is missing?", "Contact support or your sponsor before submitting registration."],
  ["Registration & Login", "How do I reset my password?", "Use the password reset option on the login page."],
  ["Roles & Permissions", "Which role should read-only users have?", "Use Viewer for stakeholders who need read-only access."],
  ["Roles & Permissions", "Can Viewers upload evidence?", "No. Viewers are read-only."],
  ["Roles & Permissions", "Who can invite users?", "OrgAdmins and OrgOwners can invite organization users where enabled."],
  ["Roles & Permissions", "Why can't I see a feature?", "Your role or tier may not include that feature."],
  ["Roles & Permissions", "Can Sponsor Observers edit organization data?", "No. Sponsor and Program Observers are read-only."],
  ["Company Profile", "Why complete Company Profile first?", "Reports and SSP output use Company Profile information."],
  ["Company Profile", "Which profile fields matter most?", "Legal name, contacts, CAGE, UEI, NAICS, locations, FCI/CUI handling, and providers."],
  ["Company Profile", "Who can edit Company Profile?", "OrgAdmins, OrgOwners, and SuperAdmins where applicable."],
  ["Company Profile", "What if CAGE or UEI is missing?", "Complete it when available; missing values may reduce profile completeness."],
  ["Company Profile", "Does Company Profile affect SSP?", "Yes. SSP uses profile and scope fields where available."],
  ["Assessments", "Where do I start an assessment?", "Open CMMC Level 1 or Level 2 domains from the sidebar."],
  ["Assessments", "Why is Level 2 locked?", "Your tier may not include Level 2 access."],
  ["Assessments", "What does Met mean?", "The practice appears satisfied and should be supported by evidence."],
  ["Assessments", "Should I add notes?", "Yes. Notes explain implementation context and support reporting."],
  ["Assessments", "What if I am unsure of status?", "Use Not Assessed or Partially Met and request review."],
  ["Evidence", "Who can upload evidence?", "OrgAdmins, Contributors, Assessors, and SuperAdmins where allowed."],
  ["Evidence", "Can one file support multiple practices?", "Yes, if it genuinely supports each practice."],
  ["Evidence", "What is OCR?", "OCR extracts readable text from documents when supported."],
  ["Evidence", "Should OCR be reviewed?", "Yes. OCR can be incomplete or inaccurate."],
  ["Evidence", "Can sponsors see evidence files?", "No. Sponsor views show counts and summaries only."],
  ["Reports", "Which report is for leadership?", "Use Executive Readiness Report."],
  ["Reports", "What is SSP?", "System Security Plan output for system and security context."],
  ["Reports", "What is SPRS?", "Supplier Performance Risk System score support."],
  ["Reports", "What is POA&M?", "Plan of Action and Milestones for gaps and remediation."],
  ["Reports", "Why is a report incomplete?", "Company Profile, assessment, evidence, or POA&M source data may be incomplete."],
  ["Marketplace", "What is Marketplace?", "A vendor directory and engagement tracking area."],
  ["Marketplace", "Are vendors endorsed?", "Marketplace listings are informational; evaluate vendors independently."],
  ["Marketplace", "How do I find vendors?", "Use search and filters by category, role, state, remote availability, or program support."],
  ["Marketplace", "Can I view vendor profiles?", "Yes, authenticated users can view active vendor profiles."],
  ["Marketplace", "Can Sponsor Observers edit vendors?", "No. Vendor administration is SuperAdmin-only."],
  ["Vendor Reviews", "Who can submit reviews?", "Authorized organization users where enabled."],
  ["Vendor Reviews", "Why is my review not visible?", "Reviews require SuperAdmin moderation before public display."],
  ["Vendor Reviews", "Can reviews include sensitive data?", "No. Do not include confidential, pricing, contractual, legal, or security details."],
  ["Vendor Reviews", "Who moderates reviews?", "SuperAdmins."],
  ["Vendor Reviews", "Can Sponsor Observers moderate reviews?", "No, unless they also have SuperAdmin access."],
  ["Vendor Engagement", "What is vendor engagement?", "Metadata tracking vendors your organization is evaluating or using."],
  ["Vendor Engagement", "What does active mean?", "Your organization is currently working with the vendor."],
  ["Vendor Engagement", "Can engagements store contracts?", "No. They store metadata, not contracts or private messages."],
  ["Vendor Engagement", "Where do I see my engagements?", "In Marketplace under My Vendor Engagements."],
  ["Vendor Engagement", "Do analytics count active engagements?", "Yes. Active Vendor Engagements counts active status records."],
  ["Sponsored Programs", "What is a sponsored program?", "A sponsor/state/partner program used for enrollment and oversight."],
  ["Sponsored Programs", "Can a sponsored org use Company Profile?", "Yes. Sponsored organizations use the same core readiness workspace."],
  ["Sponsored Programs", "Can program assignment replace tier?", "No. Program assignment controls enrollment and visibility; tier controls feature access."],
  ["Sponsored Programs", "Who assigns programs?", "SuperAdmins manage program assignment."],
  ["Sponsored Programs", "Can sponsored orgs generate reports?", "Yes, subject to role and tier access."],
  ["Sponsor Observers", "What can Sponsor Observers see?", "Sanitized readiness summaries, counts, report flags, activity metadata, and vendor engagement summaries."],
  ["Sponsor Observers", "What can observers not see?", "Raw evidence, filenames, notes, AI conversations, remediation details, and report contents."],
  ["Sponsor Observers", "What is Program Observer scoping?", "Observers see only organizations assigned to their program IDs."],
  ["Sponsor Observers", "Can observers approve registrations?", "No."],
  ["Sponsor Observers", "Can observers access Marketplace?", "Yes, read-only marketplace access is available."],
  ["Troubleshooting", "I cannot log in. What should I do?", "Reset password or contact support if your account may be pending or inactive."],
  ["Troubleshooting", "I cannot upload evidence. Why?", "Your role may be read-only or lack upload permission."],
  ["Troubleshooting", "My report has wrong org name. What should I check?", "Review Company Profile legal/company name fields."],
  ["Troubleshooting", "Program observer sees no participants. Why?", "Program assignment or observer program scope may need review."],
  ["Troubleshooting", "How do I request help?", "Use Send Feedback with category, page, expected result, actual result, and blocker status."],
];

export const HelpFaqPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const categories = useMemo(() => Array.from(new Set(faqSeed.map(item => item[0]))), []);
  const filtered = faqSeed.filter(([cat, question, answer]) => {
    const q = query.trim().toLowerCase();
    return (!category || cat === category) && (!q || `${cat} ${question} ${answer}`.toLowerCase().includes(q));
  });
  return (
    <HelpPageShell eyebrow="Help Center" title="FAQs" subtitle="Search answers by category or keyword.">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="md:col-span-2 flex items-center rounded border px-3 py-2">
            <Search className="mr-2 h-4 w-4 text-gray-400" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search FAQs..." className="w-full text-sm outline-none" />
          </label>
          <select value={category} onChange={event => setCategory(event.target.value)} className="rounded border px-3 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </section>
      <section className="space-y-3">
        {filtered.map(([cat, question, answer], index) => (
          <article key={`${cat}-${question}-${index}`} className="rounded-lg border bg-white p-4 shadow-sm">
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{cat}</span>
            <h2 className="mt-3 font-bold text-gray-900">{question}</h2>
            <p className="mt-2 text-sm text-gray-700">{answer}</p>
            <p className="mt-2 text-xs font-semibold uppercase text-gray-500">Related area: {cat}</p>
          </article>
        ))}
      </section>
    </HelpPageShell>
  );
};

export const HelpSupportPage: React.FC = () => (
  <HelpPageShell eyebrow="Help Center" title="Support" subtitle="Get help with CMMC Launch Hub.">
    <div className="grid gap-4 lg:grid-cols-2">
      <StepCard title="Contact Support"><p>Use Send Feedback from any authenticated page. Include issue category and page context.</p></StepCard>
      <StepCard title="What to Include in a Support Request">
        <ul className="list-disc space-y-1 pl-5">
          <li>Organization name</li><li>Page</li><li>What you expected</li><li>What happened</li><li>Error message</li><li>Whether work is blocked</li><li>Screenshot if available</li>
        </ul>
      </StepCard>
      <StepCard title="Support Categories"><p>Bug, Feature Request, Question, Access Issue, Report Issue, Evidence Issue, Marketplace Issue, Program Issue.</p></StepCard>
      <StepCard title="Support Process"><ol className="list-decimal space-y-1 pl-5"><li>Submit feedback.</li><li>SuperAdmin reviews.</li><li>Issue is triaged.</li><li>Fix is scheduled or response is provided.</li><li>Item is closed when resolved.</li></ol></StepCard>
    </div>
    <Callout type="WARNING">Urgent blockers include inability to log in, inability to access organization, blocked required report submission, blocked evidence upload, or Program Observer inability to access an assigned program.</Callout>
  </HelpPageShell>
);

export const HelpWhatsNewPage: React.FC = () => (
  <HelpPageShell eyebrow="Help Center" title="What's New" subtitle="Version 1.1 release highlights and upcoming roadmap items.">
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">Version 1.1 highlights</h2>
      <ul className="mt-4 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
        {["Commercial vs Sponsored Program registration", "Program Management", "Program Observers", "Sponsor Dashboard", "Participants and Participant Detail", "Program Analytics", "Marketplace", "Marketplace Ratings & Reviews", "Vendor Engagement Tracking", "SuperAdmin Active Orgs", "SuperAdmin Org Detail", "Help Center"].map(item => <li key={item} className="rounded border bg-gray-50 px-3 py-2">{item}</li>)}
      </ul>
    </section>
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">Coming Next</h2>
      <p className="mt-1 text-sm font-semibold text-blue-700">Future Enhancement</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
        <li>Pilot Production Readiness</li>
        <li>Marketplace Request Vendor</li>
        <li>Readiness-aware vendor recommendations</li>
        <li>Program exports</li>
        <li>Expanded training videos</li>
      </ul>
    </section>
  </HelpPageShell>
);

export const helpTitle = (section: HelpSection) => {
  if (section === "getting-started") return "Getting Started";
  if (section === "user-guide") return "User Guide";
  if (section === "videos") return "Video Tutorials";
  if (section === "faqs") return "FAQs";
  if (section === "support") return "Support";
  if (section === "whats-new") return "What's New";
  return "Help Center";
};
