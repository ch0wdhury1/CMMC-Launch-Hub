import React from "react";
import {
  buildResponsibilityAssignment,
  type ActiveOrgMember,
  type ResponsibilityAssignmentUpdate,
} from "../src/responsibilityAssignments";

export interface ResponsibilityAssignmentContext {
  members: ActiveOrgMember[];
  uid: string;
  canAssign: boolean;
}

interface Props {
  value?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  context?: ResponsibilityAssignmentContext;
  onChange: (assignment: ResponsibilityAssignmentUpdate) => void;
  className?: string;
}

export const ResponsibilityAssignmentSelect: React.FC<Props> = ({
  value,
  assignedToName,
  assignedToEmail,
  context,
  onChange,
  className = "",
}) => {
  if (!context) return null;

  const assignedLabel = assignedToName || assignedToEmail || value || "Unassigned";

  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-600 mb-1">Assigned To</label>
      <select
        value={value || ""}
        disabled={!context.canAssign}
        onChange={(event) => {
          const member = context.members.find(option => option.uid === event.target.value);
          onChange(buildResponsibilityAssignment(member, context.uid));
        }}
        className="w-full border border-gray-300 p-1.5 rounded bg-white text-black text-xs disabled:bg-gray-100 disabled:text-gray-500"
      >
        <option value="">Unassigned</option>
        {context.members.map(member => (
          <option key={member.uid} value={member.uid}>
            {member.name}{member.email && member.email !== member.name ? ` (${member.email})` : ""}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11px] text-gray-500 truncate" title={assignedLabel}>
        {assignedLabel}
      </p>
    </div>
  );
};
