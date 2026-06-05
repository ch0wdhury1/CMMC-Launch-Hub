import React from "react";
import { FlaskConical } from "lucide-react";

type Props = {
  orgName: string;
  onSupportClick: () => void;
};

export const PilotParticipantBanner: React.FC<Props> = ({ orgName, onSupportClick }) => (
  <section className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-3">
        <FlaskConical className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700" />
        <div>
          <div className="font-semibold">Controlled Pilot Participant</div>
          <p className="mt-1 text-blue-900">
            {orgName} is using the pilot environment. Use Send Feedback for issues, questions, and launch observations.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSupportClick}
        className="self-start rounded-md border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 md:self-center"
      >
        Pilot Support
      </button>
    </div>
  </section>
);
