import React from "react";
import { BookOpen, HelpCircle, LifeBuoy, MessageSquare, Route } from "lucide-react";

type Props = {
  onFeedbackClick?: () => void;
};

const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) => (
  <section className="rounded-lg border bg-white p-5 shadow-sm">
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-blue-700" />
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
    </div>
    <div className="mt-3 text-sm text-gray-700">{children}</div>
  </section>
);

export const SupportPage: React.FC<Props> = () => (
  <div className="space-y-5 pb-8">
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase text-blue-700">Pilot support</p>
      <h1 className="mt-1 text-2xl font-bold text-gray-900">Support Page</h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-700">
        CMMC Launch Hub pilot participants receive guided onboarding and direct founder support. Use the in-app feedback button for product issues, pilot questions, and support requests.
      </p>
    </section>

    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="Contact Information" icon={LifeBuoy}>
        <dl className="space-y-3">
          <div>
            <dt className="font-semibold text-gray-900">Primary support channel</dt>
            <dd>Use the global Send Feedback button from any authenticated page.</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-900">Guided onboarding</dt>
            <dd>Coordinate through the direct founder support contact provided during pilot enrollment.</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-900">Urgent pilot blocker</dt>
            <dd>Submit feedback as Bug and include the organization, page, expected result, and blocker impact.</dd>
          </div>
        </dl>
      </Section>

      <Section title="FAQ Links" icon={HelpCircle}>
        <ul className="list-disc space-y-2 pl-5">
          <li>PILOT_FAQ.md for common pilot questions.</li>
          <li>PILOT_ONBOARDING_GUIDE.md for user onboarding steps.</li>
          <li>PILOT_ENROLLMENT_GUIDE.md for organization enrollment.</li>
          <li>PILOT_SUPPORT_PLAYBOOK.md for support triage and escalation.</li>
        </ul>
      </Section>

      <Section title="Pilot Onboarding Resources" icon={BookOpen}>
        <ul className="list-disc space-y-2 pl-5">
          <li>Complete registration and SuperAdmin approval.</li>
          <li>Confirm organization profile, tier, and pilot participants.</li>
          <li>Invite OrgAdmin, Contributor, Assessor, and Viewer users as needed.</li>
          <li>Start from Command Dashboard to review readiness, evidence, and reporting shortcuts.</li>
        </ul>
      </Section>

      <Section title="Support Process" icon={Route}>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Submit feedback with category and page context.</li>
          <li>SuperAdmin reviews the feedback queue and marks items reviewed or closed.</li>
          <li>Pilot support triages blockers, fixture limitations, and documentation questions separately.</li>
          <li>Confirmed defects are scheduled into the next controlled remediation phase.</li>
        </ol>
      </Section>
    </div>

    <section className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950">
      <div className="flex gap-3">
        <MessageSquare className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700" />
        <div>
          <h2 className="font-bold">Feedback categories</h2>
          <p className="mt-1">Bug, Feature Request, Question, and Other are routed to the SuperAdmin feedback review queue.</p>
        </div>
      </div>
    </section>
  </div>
);
