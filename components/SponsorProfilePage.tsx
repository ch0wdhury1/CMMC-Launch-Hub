import React from "react";

type Props = {
  profile: any;
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded border bg-gray-50 p-3">
    <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-gray-900">{value || "Not provided"}</div>
  </div>
);

export const SponsorProfilePage: React.FC<Props> = ({ profile }) => {
  const sponsorProgram = profile?.sponsorProgram === "Other"
    ? profile?.sponsorProgramOther || "Other"
    : profile?.sponsorProgram;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase text-blue-700">Sponsor Observer</p>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-sm text-gray-600">Read-only account context for pilot oversight access.</p>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <Row label="Name" value={profile?.displayName || profile?.fullName} />
        <Row label="Email" value={profile?.email} />
        <Row label="Role" value="Sponsor Observer" />
        <Row label="Sponsor Program" value={sponsorProgram} />
        <Row label="Status" value={profile?.status || "active"} />
      </section>
    </div>
  );
};

