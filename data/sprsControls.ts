export interface SprsControl {
  id: string;
  family: string;
  description: string;
  weight: number;
  mappedPracticeIds?: string[];
}

export const SPRS_CONTROLS: SprsControl[] = [
  // Access Control (AC)
  { id: '3.1.1', family: 'Access Control', description: 'Limit system access to authorized users.', weight: -5, mappedPracticeIds: ['AC.L1-3.1.1'] },
  { id: '3.1.2', family: 'Access Control', description: 'Limit access to authorized transactions.', weight: -5, mappedPracticeIds: ['AC.L1-3.1.2'] },
  { id: '3.1.3', family: 'Access Control', description: 'Control the flow of CUI.', weight: -3 },
  { id: '3.1.4', family: 'Access Control', description: 'Separate duties of individuals.', weight: -3 },
  { id: '3.1.5', family: 'Access Control', description: 'Prevent non-privileged users from executing privileged functions.', weight: -5 },
  { id: '3.1.6', family: 'Access Control', description: 'Limit unsuccessful logon attempts.', weight: -3 },
  { id: '3.1.7', family: 'Access Control', description: 'Use session lock.', weight: -1 },
  { id: '3.1.8', family: 'Access Control', description: 'Limit session time.', weight: -1 },
  { id: '3.1.9', family: 'Access Control', description: 'Authorize remote execution.', weight: -3 },
  { id: '3.1.10', family: 'Access Control', description: 'Authorize wireless access.', weight: -3 },
  { id: '3.1.11', family: 'Access Control', description: 'Terminate sessions after inactivity.', weight: -3 },
  { id: '3.1.12', family: 'Access Control', description: 'Monitor remote access sessions.', weight: -5 },
  { id: '3.1.13', family: 'Access Control', description: 'Employ cryptographic mechanisms to protect remote sessions.', weight: -3 },
  { id: '3.1.14', family: 'Access Control', description: 'Route remote access through managed access control points.', weight: -3 },
  { id: '3.1.15', family: 'Access Control', description: 'Authorize remote access for privileged functions.', weight: -5 },
  { id: '3.1.16', family: 'Access Control', description: 'Protect CUI on mobile devices.', weight: -3 },
  { id: '3.1.17', family: 'Access Control', description: 'Use cryptography to protect CUI on mobile devices.', weight: -3 },
  { id: '3.1.18', family: 'Access Control', description: 'Control connection of mobile devices.', weight: -3 },
  { id: '3.1.19', family: 'Access Control', description: 'Encrypt CUI on mobile devices.', weight: -3 },
  { id: '3.1.20', family: 'Access Control', description: 'Verify and control connections to external systems.', weight: -1, mappedPracticeIds: ['AC.L1-3.1.20'] },
  { id: '3.1.21', family: 'Access Control', description: 'Control CUI sharing with external systems.', weight: -3 },
  { id: '3.1.22', family: 'Access Control', description: 'Control information posted on publicly accessible systems.', weight: -1, mappedPracticeIds: ['AC.L1-3.1.22'] },

  // Awareness and Training (AT)
  { id: '3.2.1', family: 'Awareness and Training', description: 'Ensure managers and users are made aware of security risks.', weight: -3 },
  { id: '3.2.2', family: 'Awareness and Training', description: 'Provide security awareness training on handling CUI.', weight: -3 },
  { id: '3.2.3', family: 'Awareness and Training', description: 'Provide role-based security training.', weight: -3 },

  // Audit and Accountability (AU)
  { id: '3.3.1', family: 'Audit and Accountability', description: 'Create and retain system audit logs.', weight: -3 },
  { id: '3.3.2', family: 'Audit and Accountability', description: 'Ensure actions of individual users can be uniquely traced.', weight: -3 },
  { id: '3.3.3', family: 'Audit and Accountability', description: 'Review and update audited events.', weight: -3 },
  { id: '3.3.4', family: 'Audit and Accountability', description: 'Alert in the event of an audit process failure.', weight: -3 },
  { id: '3.3.5', family: 'Audit and Accountability', description: 'Correlate audit review findings.', weight: -5 },
  { id: '3.3.6', family: 'Audit and Accountability', description: 'Provide audit reduction and report generation.', weight: -1 },
  { id: '3.3.7', family: 'Audit and Accountability', description: 'Provide an audit trail.', weight: -3 },
  { id: '3.3.8', family: 'Audit and Accountability', description: 'Protect audit information from unauthorized access.', weight: -5 },
  { id: '3.3.9', family: 'Audit and Accountability', description: 'Limit management of audit functionality to a subset of privileged users.', weight: -5 },

  // Configuration Management (CM)
  { id: '3.4.1', family: 'Configuration Management', description: 'Establish and maintain baseline configurations.', weight: -3 },
  { id: '3.4.2', family: 'Configuration Management', description: 'Employ the principle of least functionality.', weight: -3 },
  { id: '3.4.3', family: 'Configuration Management', description: 'Control changes to systems.', weight: -3 },
  { id: '3.4.4', family: 'Configuration Management', description: 'Analyze the security impact of changes.', weight: -3 },
  { id: '3.4.5', family: 'Configuration Management', description: 'Define, document, approve, and enforce physical and logical access restrictions.', weight: -3 },
  { id: '3.4.6', family: 'Configuration Management', description: 'Employ automated mechanisms to manage baseline configurations.', weight: -3 },
  { id: '3.4.7', family: 'Configuration Management', description: 'Restrict, disable, and prevent the use of nonessential programs, functions, ports, protocols, and services.', weight: -5 },
  { id: '3.4.8', family: 'Configuration Management', description: 'Apply deny-by-exception (blacklist) policy.', weight: -3 },
  { id: '3.4.9', family: 'Configuration Management', description: 'Control and monitor user-installed software.', weight: -5 },

  // Identification and Authentication (IA)
  { id: '3.5.1', family: 'Identification and Authentication', description: 'Identify system users, processes, and devices.', weight: -3, mappedPracticeIds: ['IA.L1-3.5.1'] },
  { id: '3.5.2', family: 'Identification and Authentication', description: 'Authenticate users, processes, or devices.', weight: -3, mappedPracticeIds: ['IA.L1-3.5.2'] },
  { id: '3.5.3', family: 'Identification and Authentication', description: 'Use multifactor authentication.', weight: -5 },
  { id: '3.5.4', family: 'Identification and Authentication', description: 'Prevent reuse of identifiers for a defined period.', weight: -1 },
  { id: '3.5.5', family: 'Identification and Authentication', description: 'Disable identifiers after a defined period of inactivity.', weight: -1 },
  { id: '3.5.6', family: 'Identification and Authentication', description: 'Manage default authenticators.', weight: -3 },
  { id: '3.5.7', family: 'Identification and Authentication', description: 'Enforce minimum password complexity.', weight: -3 },
  { id: '3.5.8', family: 'Identification and Authentication', description: 'Prohibit password reuse for a number of generations.', weight: -3 },
  { id: '3.5.9', family: 'Identification and Authentication', description: 'Allow temporary password use for system logons with an immediate change.', weight: -3 },
  { id: '3.5.10', family: 'Identification and Authentication', description: 'Store and transmit passwords in a protected form.', weight: -3 },
  { id: '3.5.11', family: 'Identification and Authentication', description: 'Obscure feedback of authentication information.', weight: -1 },

  // Incident Response (IR)
  { id: '3.6.1', family: 'Incident Response', description: 'Establish an operational incident-handling capability.', weight: -5 },
  { id: '3.6.2', family: 'Incident Response', description: 'Track, document, and report incidents.', weight: -3 },
  { id: '3.6.3', family: 'Incident Response', description: 'Test the incident response capability.', weight: -3 },
  
  // Maintenance (MA)
  { id: '3.7.1', family: 'Maintenance', description: 'Perform maintenance on organizational systems.', weight: -1 },
  { id: '3.7.2', family: 'Maintenance', description: 'Control maintenance tools.', weight: -3 },
  { id: '3.7.3', family: 'Maintenance', description: 'Approve and monitor nonlocal maintenance.', weight: -3 },
  { id: '3.7.4', family: 'Maintenance', description: 'Supervise maintenance personnel.', weight: -1 },
  { id: '3.7.5', family: 'Maintenance', description: 'Use multifactor authentication for nonlocal maintenance.', weight: -3 },
  { id: '3.7.6', family: 'Maintenance', description: 'Sanitize equipment to remove CUI.', weight: -3 },

  // Media Protection (MP)
  { id: '3.8.1', family: 'Media Protection', description: 'Protect system media containing CUI.', weight: -3 },
  { id: '3.8.2', family: 'Media Protection', description: 'Limit access to CUI on system media to authorized users.', weight: -3 },
  { id: '3.8.3', family: 'Media Protection', description: 'Sanitize or destroy system media containing CUI.', weight: -5, mappedPracticeIds: ['MP.L1-3.8.3'] },
  { id: '3.8.4', family: 'Media Protection', description: 'Mark media with CUI markings and distribution limitations.', weight: -1 },
  { id: '3.8.5', family: 'Media Protection', description: 'Control access to media storage areas.', weight: -1 },
  { id: '3.8.6', family: 'Media Protection', description: 'Control the use of removable media on system components.', weight: -3 },
  { id: '3.8.7', family: 'Media Protection', description: 'Use cryptographic mechanisms to protect CUI on digital media.', weight: -3 },
  { id: '3.8.8', family: 'Media Protection', description: 'Prohibit the use of portable storage devices when such devices have no identifiable owner.', weight: -5 },
  { id: '3.8.9', family: 'Media Protection', description: 'Protect the confidentiality of backup CUI at storage locations.', weight: -3 },

  // Physical Protection (PE)
  { id: '3.10.1', family: 'Physical Protection', description: 'Limit physical access to systems to authorized individuals.', weight: -5, mappedPracticeIds: ['PE.L1-3.10.1'] },
  { id: '3.10.2', family: 'Physical Protection', description: 'Protect and monitor the physical facility and support infrastructure.', weight: -3 },
  { id: '3.10.3', family: 'Physical Protection', description: 'Escort visitors and monitor visitor activity.', weight: -3, mappedPracticeIds: ['PE.L1-3.10.3'] },
  { id: '3.10.4', family: 'Physical Protection', description: 'Maintain audit logs of physical access.', weight: -3, mappedPracticeIds: ['PE.L1-3.10.4'] },
  { id: '3.10.5', family: 'Physical Protection', description: 'Control and manage physical access devices.', weight: -3, mappedPracticeIds: ['PE.L1-3.10.5'] },
  { id: '3.10.6', family: 'Physical Protection', description: 'Enforce safeguarding measures for CUI at alternate work sites.', weight: -3 },
  
  // Personnel Security (PS)
  { id: '3.9.1', family: 'Personnel Security', description: 'Screen individuals prior to authorizing access.', weight: -3 },
  { id: '3.9.2', family: 'Personnel Security', description: 'Ensure that systems containing CUI are protected during and after personnel actions.', weight: -3 },
  
  // Risk Assessment (RA)
  { id: '3.11.1', family: 'Risk Assessment', description: 'Periodically assess the risk to organizational operations.', weight: -5 },
  { id: '3.11.2', family: 'Risk Assessment', description: 'Scan for vulnerabilities and remediate.', weight: -5 },
  { id: '3.11.3', family: 'Risk Assessment', description: 'Remediate vulnerabilities in accordance with risk assessments.', weight: -5 },

  // Security Assessment (CA)
  { id: '3.12.1', family: 'Security Assessment', description: 'Periodically assess the security controls in organizational systems.', weight: -5 },
  { id: '3.12.2', family: 'Security Assessment', description: 'Develop and implement plans of action.', weight: -3 },
  { id: '3.12.3', family: 'Security Assessment', description: 'Monitor security controls.', weight: -3 },
  { id: '3.12.4', family: 'Security Assessment', description: 'Develop, document, and periodically update a system security plan (SSP).', weight: -5 },
  
  // System and Communications Protection (SC)
  { id: '3.13.1', family: 'System and Communications Protection', description: 'Monitor, control, and protect communications at boundaries.', weight: -3, mappedPracticeIds: ['SC.L1-3.13.1'] },
  { id: '3.13.2', family: 'System and Communications Protection', description: 'Employ architectural designs that promote security.', weight: -3 },
  { id: '3.13.3', family: 'System and Communications Protection', description: 'Separate user functionality from system management functionality.', weight: -3 },
  { id: '3.13.4', family: 'System and Communications Protection', description: 'Prevent unauthorized information transfer via shared resources.', weight: -5 },
  { id: '3.13.5', family: 'System and Communications Protection', description: 'Implement subnetworks for publicly accessible components.', weight: -3, mappedPracticeIds: ['SC.L1-3.13.5'] },
  { id: '3.13.6', family: 'System and Communications Protection', description: 'Deny network communications traffic by default and allow by exception (whitelisting).', weight: -5 },
  { id: '3.13.7', family: 'System and Communications Protection', description: 'Prevent remote devices from spoofing internal communications.', weight: -5 },
  { id: '3.13.8', family: 'System and Communications Protection', description: 'Implement cryptographic mechanisms to prevent unauthorized disclosure of CUI.', weight: -3 },
  { id: '3.13.9', family: 'System and Communications Protection', description: 'Terminate network connections associated with communications sessions.', weight: -1 },
  { id: '3.13.10', family: 'System and Communications Protection', description: 'Establish and manage cryptographic keys.', weight: -5 },
  { id: '3.13.11', family: 'System and Communications Protection', description: 'Employ FIPS-validated cryptography.', weight: -3 },
  { id: '3.13.12', family: 'System and Communications Protection', description: 'Prohibit remote activation of collaborative computing devices.', weight: -1 },
  { id: '3.13.13', family: 'System and Communications Protection', description: 'Control and monitor the use of mobile code.', weight: -3 },
  { id: '3.13.14', family: 'System and Communications Protection', description: 'Control and monitor the use of VoIP technologies.', weight: -3 },
  { id: '3.13.15', family: 'System and Communications Protection', description: 'Protect the authenticity of communications sessions.', weight: -5 },
  { id: '3.13.16', family: 'System and Communications Protection', description: 'Protect the confidentiality of CUI at rest.', weight: -3 },
  
  // System and Information Integrity (SI)
  { id: '3.14.1', family: 'System and Information Integrity', description: 'Identify, report, and correct system flaws.', weight: -5, mappedPracticeIds: ['SI.L1-3.14.1'] },
  { id: '3.14.2', family: 'System and Information Integrity', description: 'Provide protection from malicious code.', weight: -5, mappedPracticeIds: ['SI.L1-3.14.2'] },
  { id: '3.14.3', family: 'System and Information Integrity', description: 'Monitor system security alerts and advisories.', weight: -3 },
  { id: '3.14.4', family: 'System and Information Integrity', description: 'Update malicious code protection mechanisms.', weight: -3, mappedPracticeIds: ['SI.L1-3.14.4'] },
  { id: '3.14.5', family: 'System and Information Integrity', description: 'Perform periodic scans of the information system and real-time scans of files.', weight: -3, mappedPracticeIds: ['SI.L1-3.14.5'] },
  { id: '3.14.6', family: 'System and Information Integrity', description: 'Monitor the system for unauthorized use and unusual activity.', weight: -5 },
  { id: '3.14.7', family: 'System and Information Integrity', description: 'Identify unauthorized use of the system.', weight: -5 },
];