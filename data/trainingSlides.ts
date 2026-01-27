
export type TrainingAudience = 'leadership' | 'technical' | 'awareness';

export interface TrainingTopic {
  label: string;
  details: string;
}

export interface TrainingSlide {
  id: number;
  title: string;
  description: string;
  topics: TrainingTopic[];
}

export interface TrainingTrack {
  id: TrainingAudience;
  label: string;
  description: string;
  slides: TrainingSlide[];
}

export const trainingTracks: TrainingTrack[] = [
  {
    id: 'leadership',
    label: 'Leadership / Management',
    description: 'High-level overview and responsibilities for executives, owners, and managers.',
    slides: [
      {
        id: 1,
        title: 'Introduction to CMMC & Leadership’s Role',
        description: 'Understand the fundamentals of CMMC Level 1 and why leadership is the cornerstone of a successful compliance strategy.',
        topics: [
          {
            label: 'What CMMC Level 1 is',
            details: 'CMMC Level 1 focuses on safeguarding Federal Contract Information (FCI). It consists of 15 basic cybersecurity practices that establish a foundational level of "cyber hygiene." This level is designed to protect contractor information systems and is a prerequisite for any organization handling FCI.'
          },
          {
            label: 'Why leadership involvement matters',
            details: 'Leadership involvement is crucial for a successful CMMC implementation. It signals to the entire organization that cybersecurity is a top priority. Leaders are responsible for allocating the necessary budget and resources, setting clear expectations, and holding teams accountable for meeting compliance goals.'
          },
          {
            label: 'Risk ownership and accountability',
            details: 'Executives and managers must formally own cybersecurity risks. This involves identifying potential threats, understanding their business impact, and assigning specific individuals or teams the responsibility for managing and mitigating those risks. Accountability ensures that security tasks are not overlooked.'
          }
        ]
      },
      {
        id: 2,
        title: 'Why CMMC Exists',
        description: 'Learn about the strategic importance of CMMC for the Department of Defense (DoD) and the entire Defense Industrial Base (DIB).',
        topics: [
          {
            label: 'Protect Federal Contract Information (FCI)',
            details: 'FCI is information provided by or generated for the Government under a contract that is not intended for public release. While not as sensitive as CUI, its loss could still provide adversaries with valuable insights. CMMC ensures this data is protected.'
          },
          {
            label: 'Reduce cyber incidents across the Defense Industrial Base',
            details: 'The DIB is a frequent target of cyberattacks. By requiring a baseline level of security across all contractors, the DoD aims to strengthen the entire supply chain, making it more resilient against espionage and disruption.'
          },
          {
            label: 'Ensure only secure contractors handle DoD data',
            details: 'CMMC acts as a verification mechanism. It provides the DoD with assurance that its contractors have implemented the necessary security controls to protect government information, thereby reducing supply chain risk.'
          }
        ]
      },
      {
        id: 3,
        title: 'Scope of CMMC Level 1',
        description: 'Clarify what is and is not covered by Level 1, and for whom it applies.',
        topics: [
          {
            label: 'Covers ONLY FCI',
            details: 'CMMC Level 1 is specifically for the protection of Federal Contract Information (FCI). If your organization handles the more sensitive Controlled Unclassified Information (CUI), you will be required to meet higher CMMC levels (Level 2 or 3).'
          },
          {
            label: '15 foundational security practices',
            details: 'Level 1 is based on the 15 security requirements found in Federal Acquisition Regulation (FAR) 52.204-21. These are fundamental practices like access control, malware protection, and physical security.'
          },
          {
            label: 'Applies to most small and midsize defense contractors',
            details: 'Any company that does business with the DoD and handles FCI will need to achieve CMMC Level 1 certification. This includes a vast number of small and midsize businesses who are subcontractors to larger prime contractors.'
          }
        ]
      },
      {
        id: 4,
        title: 'Business Impact of Non-Compliance',
        description: 'Understand the serious financial and reputational consequences of failing to achieve CMMC certification.',
        topics: [
          {
            label: 'Loss of DoD contracts (current and future)',
            details: 'CMMC is becoming a "go/no-go" requirement in DoD contracts. Without the required certification level, your company will be ineligible to bid on new contracts or even continue work on existing ones that include the CMMC clause.'
          },
          {
            label: 'Reputational damage and loss of trust',
            details: 'Failing to meet cybersecurity standards can damage your company\'s reputation. Prime contractors and government agencies may view non-compliant companies as a security risk, leading to a loss of trust and business opportunities.'
          },
          {
            label: 'Removal from prime contractors’ supply chains',
            details: 'Prime contractors are responsible for the security of their entire supply chain. They will actively remove subcontractors who cannot meet CMMC requirements to protect their own compliance status and reduce their risk.'
          },
          {
            label: 'Competitive disadvantage in bids',
            details: 'Even before it is a strict requirement, companies that are already CMMC certified will have a significant competitive advantage when bidding on contracts. It demonstrates a proactive and mature approach to security.'
          }
        ]
      },
      {
        id: 5,
        title: 'Leadership Responsibilities',
        description: 'Explore the specific, actionable duties that fall to the leadership team in a CMMC compliance effort.',
        topics: [
          {
            label: 'Approve cybersecurity policies and procedures',
            details: 'Leadership must formally review and approve key documents, such as the Access Control Policy or Incident Response Plan. This approval gives the policies authority and makes them official company doctrine.'
          },
          {
            label: 'Allocate budget and resources for security',
            details: 'Effective cybersecurity requires investment in tools (like firewalls or antivirus software), personnel (training or dedicated roles), and time. Leadership is responsible for ensuring the compliance effort is adequately funded.'
          },
          {
            label: 'Monitor compliance progress and risks',
            details: 'Compliance is not a one-time project. Leadership must establish a rhythm for reviewing progress, understanding roadblocks, and making strategic decisions about identified security risks.'
          },
          {
            label: 'Ensure staff training and accountability',
            details: 'The human element is often the weakest link. Leaders must ensure all employees receive appropriate security awareness training and that there are clear consequences for failing to follow security policies.'
          }
        ]
      },
      {
        id: 6,
        title: 'Common Leadership Mistakes',
        description: 'Identify and avoid common pitfalls that can derail a CMMC compliance project.',
        topics: [
          {
            label: 'Assuming IT owns all compliance obligations',
            details: 'While IT implements many technical controls, CMMC is a business-wide responsibility. It includes physical security, HR processes, and management oversight. Delegating CMMC entirely to IT is a common path to failure.'
          },
          {
            label: 'Delaying decisions on policies and tools',
            details: 'Indecision can halt progress. Leadership must make timely decisions on policy content, tool selection, and budget allocation to keep the project moving forward.'
          },
          {
            label: 'Underestimating documentation requirements',
            details: 'CMMC requires not just doing the security practices, but proving you do them. This means documenting policies, procedures, and configurations. Underestimating this effort is a frequent mistake.'
          },
          {
            label: 'Not enforcing employee behavior consistently',
            details: 'Having a policy is not enough; it must be enforced. If leadership allows exceptions or fails to hold people accountable, the security culture will weaken and controls will fail.'
          }
        ]
      },
      {
        id: 7,
        title: 'What Leadership Must Ensure',
        description: 'A checklist of critical security areas that require direct leadership oversight and confirmation.',
        topics: [
          {
            label: 'Baseline protections: MFA, antivirus, secure configurations',
            details: 'Leaders should ask for confirmation that foundational tools like Multi-Factor Authentication (MFA) and antivirus are deployed and active everywhere. They should also ensure systems are configured securely, not just used with default settings.'
          },
          {
            label: 'Access control and physical security',
            details: 'Leadership must ensure that clear policies are in place for who can access data and physical locations (like server rooms). This includes processes for new hires, terminations, and visitor access.'
          },
          {
            label: 'Incident reporting awareness and escalation path',
            details: 'Every employee must know how to report a potential security incident and who to report it to. Leadership must ensure this process is clearly defined and communicated.'
          },
          {
            label: 'Vendor and service provider security review',
            details: 'Your security is only as strong as your vendors\'. Leadership must ensure that key service providers (like IT MSPs or cloud providers) are reviewed for their own security posture.'
          }
        ]
      },
      {
        id: 8,
        title: 'Keys to Success',
        description: 'Focus on the strategic elements that differentiate successful compliance efforts from unsuccessful ones.',
        topics: [
          {
            label: 'Visible top-down support for cybersecurity',
            details: 'When employees see leaders taking cybersecurity seriously—discussing it in meetings, approving budgets, and following the rules themselves—it fosters a strong security culture throughout the company.'
          },
          {
            label: 'Clear roles and responsibilities',
            details: 'Every CMMC requirement should have a named individual or team responsible for its implementation and maintenance. This clarity prevents tasks from being dropped or overlooked.'
          },
          {
            label: 'Realistic timelines and milestones',
            details: 'Achieving CMMC compliance takes time. Leadership should work with the implementation team to set achievable goals and track progress against a realistic project plan.'
          },
          {
            label: 'Ongoing monitoring and periodic reassessment',
            details: 'Compliance is not a destination; it\'s a continuous process. Successful organizations build in periodic reviews, check that controls are still effective, and adapt to new threats over time.'
          }
        ]
      },
      {
        id: 9,
        title: 'Next Steps for Leadership',
        description: 'A simple, actionable plan for leaders to initiate or accelerate their CMMC Level 1 compliance journey.',
        topics: [
          {
            label: 'Review the Security Readiness Analyzer results',
            details: 'Use the results from this tool\'s analyzer as a starting point. It provides a high-level gap analysis that can help you prioritize your initial efforts.'
          },
          {
            label: 'Assign internal owners for each practice',
            details: 'Go through the 15 CMMC Level 1 practices and assign a specific person to be responsible for each one. This creates immediate accountability.'
          },
          {
            label: 'Authorize implementation of missing controls',
            details: 'Based on your gap analysis, formally authorize your team to begin implementing the missing security controls. This may involve approving a project, a budget, or a new policy.'
          },
          {
            label: 'Schedule routine reviews of CMMC status',
            details: 'Put a recurring CMMC status meeting on the calendar (e.g., monthly or quarterly). This ensures the topic remains a priority and that progress continues to be made.'
          }
        ]
      }
    ]
  },
  {
    id: 'technical',
    label: 'IT & Technical Staff',
    description: 'Practical expectations for IT staff and admins implementing CMMC Level 1 controls.',
    slides: [
      {
        id: 1,
        title: 'Technical Role in CMMC Level 1',
        description: 'Understand your core responsibilities as the hands-on implementer of CMMC security controls.',
        topics: [
          {
            label: 'Implement and maintain technical controls',
            details: 'Your primary role is to configure, deploy, and manage the technical safeguards required by CMMC, such as firewalls, antivirus software, and access control settings.'
          },
          {
            label: 'Support documentation and evidence collection',
            details: 'During an assessment, you will need to provide evidence that controls are working. This includes taking screenshots of configurations, exporting logs, and helping to write down procedures.'
          },
          {
            label: 'Keep systems aligned with CMMC practices',
            details: 'Your job doesn\'t end after initial setup. You must ensure that as systems change and evolve, they continue to meet CMMC requirements through ongoing maintenance and monitoring.'
          }
        ]
      },
      {
        id: 2,
        title: 'Endpoint Protection',
        description: 'Focus on securing the most common entry points for attacks: user workstations and servers.',
        topics: [
          {
            label: 'Deploy and maintain antivirus/anti-malware',
            details: 'Ensure a reputable antivirus (AV) or endpoint protection solution is installed on all company computers, including servers. The solution should be centrally managed if possible.'
          },
          {
            label: 'Ensure real-time protection is enabled',
            details: 'The AV software must be configured for real-time scanning. This means it actively monitors files and processes as they run, rather than just scanning on a schedule. Verify this setting is active and locked.'
          },
          {
            label: 'Monitor and act on security alerts',
            details: 'You must have a process for reviewing alerts generated by the endpoint protection software. This includes investigating potential threats, quarantining malicious files, and cleaning infected systems.'
          }
        ]
      },
      {
        id: 3,
        title: 'System Hardening & Patching',
        description: 'Reduce the "attack surface" of your systems by closing security holes and removing unnecessary features.',
        topics: [
          {
            label: 'Disable unnecessary services and ports',
            details: 'Operating systems often have many services and network ports enabled by default that are not needed. You should identify and disable these to reduce potential vulnerabilities.'
          },
          {
            label: 'Apply OS and application patches regularly',
            details: 'Implement a process for promptly testing and deploying security patches for operating systems (like Windows) and third-party applications (like Adobe Reader, Java). This is one of the most critical security activities.'
          },
          {
            label: 'Restrict local admin privileges',
            details: 'Regular users should not have local administrator rights on their computers. This prevents them from installing unauthorized software and makes it harder for malware to infect the system.'
          }
        ]
      },
      {
        id: 4,
        title: 'Access Control & Authentication',
        description: 'Ensure that only authorized individuals can access company data and systems.',
        topics: [
          {
            label: 'Provision accounts based on least privilege',
            details: 'When you create a new user account, grant it only the minimum level of access required for that user to perform their job. Avoid giving everyone broad access "just in case."'
          },
          {
            label: 'Terminate access promptly when users leave',
            details: 'Have a formal "offboarding" process. When an employee leaves the company, their accounts must be disabled immediately to prevent unauthorized access.'
          },
          {
            label: 'Enable MFA where required and supported',
            details: 'Enable Multi-Factor Authentication (MFA) on all systems that support it, especially for remote access, cloud services (like Microsoft 365), and administrator accounts.'
          }
        ]
      },
      {
        id: 5,
        title: 'Network Security',
        description: 'Protect the boundaries of your network and control the flow of data.',
        topics: [
          {
            label: 'Configure firewalls with least-access rules',
            details: 'Firewall rules should follow a "deny by default" principle. Only allow the specific ports and protocols that are necessary for business functions, and block everything else.'
          },
          {
            label: 'Limit inbound and outbound traffic to what is necessary',
            details: 'Review both incoming and outgoing traffic rules. Restricting outbound traffic can help prevent data exfiltration and stop malware from "phoning home" to a command-and-control server.'
          },
          {
            label: 'Segment sensitive systems when possible',
            details: 'If possible, place more sensitive systems (like servers handling FCI) on a separate network segment or VLAN from the general user workstations. This contains the impact of a potential breach.'
          }
        ]
      },
      {
        id: 6,
        title: 'Logging & Monitoring',
        description: 'Maintain records of system activity to aid in troubleshooting and security investigations.',
        topics: [
          {
            label: 'Enable logging on key systems and security tools',
            details: 'Ensure that logging is turned on for critical devices like firewalls, servers (e.g., Windows Event Logs), and antivirus consoles. These logs provide a trail of what happened on your systems.'
          },
          {
            label: 'Review logs for suspicious activity',
            details: 'Periodically review logs for unusual events, such as multiple failed login attempts, access outside of normal business hours, or unexpected data transfers. While often manual at Level 1, this is a key practice.'
          },
          {
            label: 'Retain logs for troubleshooting and investigations',
            details: 'Make sure logs are stored for a defined period (e.g., 90 days). This is critical for forensic analysis if a security incident occurs.'
          }
        ]
      },
      {
        id: 7,
        title: 'Backups & Recovery',
        description: 'Ensure you can recover data and systems in the event of hardware failure, ransomware, or other disasters.',
        topics: [
          {
            label: 'Implement regular backups of critical systems',
            details: 'Establish a schedule for backing up important data and systems. Backups should be automated and monitored to ensure they are completing successfully.'
          },
          {
            label: 'Test restoration procedures periodically',
            details: 'A backup is useless if it can\'t be restored. You must periodically test your backups by restoring a file or a full system to verify the integrity of the backup media and the restoration process.'
          },
          {
            label: 'Protect backup media (encryption and physical security)',
            details: 'Backups contain a copy of your sensitive data, so they must be protected. This includes encrypting the backup data and, for physical media like tapes or USB drives, storing them in a secure, locked location.'
          }
        ]
      },
      {
        id: 8,
        title: 'Supporting the Assessment',
        description: 'Prepare the specific types of evidence you will need to provide to an assessor.',
        topics: [
          {
            label: 'Maintain current inventories and configuration records',
            details: 'Keep up-to-date lists of hardware assets, software, and user accounts. This documentation is essential for demonstrating that you have control over your environment.'
          },
          {
            label: 'Provide screenshots, logs, and settings as evidence',
            details: 'Be prepared to show an assessor how a control is configured. This is often done by taking screenshots of settings pages (e.g., a firewall rule, an antivirus policy) or exporting relevant log files.'
          },
          {
            label: 'Be prepared to explain how controls work in practice',
            details: 'Assessors will interview technical staff. You should be able to clearly and concisely explain how a security control is implemented and how it meets the objective of the CMMC practice.'
          }
        ]
      },
      {
        id: 9,
        title: 'Technical Next Steps',
        description: 'A simple, actionable plan for IT staff to begin or advance their CMMC Level 1 implementation.',
        topics: [
          {
            label: 'Review current configurations against Level 1 practices',
            details: 'Using the 15 practices as a checklist, go through your key systems (firewall, servers, workstations) and document how your current settings align with each requirement.'
          },
          {
            label: 'Address obvious gaps (missing AV, weak access control, etc.)',
            details: 'Prioritize fixing the most critical and straightforward gaps first. For example, if some computers are missing antivirus, deploy it immediately. If generic shared accounts are being used, create unique user accounts.'
          },
          {
            label: 'Coordinate with leadership on realistic implementation plans',
            details: 'For more complex or costly gaps, you will need management buy-in. Prepare a brief summary of the issue, the proposed solution, and the resources required, and present it to leadership for a decision.'
          }
        ]
      }
    ]
  },
  {
    id: 'awareness',
    label: 'All Employees',
    description: 'Basic cybersecurity awareness and safe behavior for all staff.',
    slides: [
      {
        id: 1,
        title: 'Why Your Actions Matter',
        description: 'Understand your personal role in the company\'s cybersecurity defense.',
        topics: [
          {
            label: 'Cyber attackers often target people, not just systems',
            details: 'It is often easier for an attacker to trick a person into clicking a bad link or giving up a password than it is to break through a firewall. This makes you a primary target and a critical line of defense.'
          },
          {
            label: 'Small mistakes can lead to big incidents',
            details: 'A single click on a phishing email or the use of a weak password can be all an attacker needs to get into our network. What seems like a small error can have major consequences for the company.'
          },
          {
            label: 'Everyone has a role in protecting company data',
            details: 'Cybersecurity is not just the IT department\'s job. Every single employee who uses a computer, sends an email, or handles company information has a responsibility to do so securely.'
          }
        ]
      },
      {
        id: 2,
        title: 'Protecting Company Information',
        description: 'Learn the fundamental rules for handling sensitive data, including FCI.',
        topics: [
          {
            label: 'Only share sensitive information with authorized people',
            details: 'Be mindful of who you are sending information to. Verify requests for sensitive data, and don\'t share it with anyone outside the company unless you have explicit authorization.'
          },
          {
            label: 'Store documents only in approved locations',
            details: 'Use official company storage solutions like the shared network drive or the company\'s Microsoft 365 / Google Workspace. Do not store company documents on your personal computer, personal cloud storage, or on unsecured USB drives.'
          },
          {
            label: 'Follow company rules for handling FCI and other data',
            details: 'Pay attention to data handling policies. If a document is marked as FCI, it requires special care. If you are unsure about the rules, ask your manager or the IT department before taking action.'
          }
        ]
      },
      {
        id: 3,
        title: 'Password & Authentication Basics',
        description: 'Protect your digital identity, which is the key to accessing company resources.',
        topics: [
          {
            label: 'Never share your passwords with anyone',
            details: 'Your password is for you and you alone. Do not share it with coworkers, your manager, or even IT. No legitimate IT professional will ever ask you for your password.'
          },
          {
            label: 'Use strong passphrases instead of simple words',
            details: 'Instead of a short, complex password like "P@ssw0rd1!", use a long but memorable passphrase like "CorrectHorseBatteryStaple!". It is much harder for attackers to guess and easier for you to remember.'
          },
          {
            label: 'Use multi-factor authentication where required',
            details: 'Multi-factor authentication (MFA) is like a second lock on your account. It requires you to provide a code from your phone in addition to your password. Use it whenever it is available, as it provides a massive boost in security.'
          }
        ]
      },
      {
        id: 4,
        title: 'Spotting Phishing & Suspicious Emails',
        description: 'Learn how to identify and respond to the most common type of cyberattack.',
        topics: [
          {
            label: 'Be cautious with unexpected links and attachments',
            details: 'If you receive an email you weren\'t expecting that contains a link or an attachment, treat it with suspicion. Hover over links to see the real destination before you click. Do not open attachments unless you are certain they are safe.'
          },
          {
            label: 'Verify sender identity when something feels off',
            details: 'Attackers are very good at faking email addresses. If you get an urgent or unusual request, especially one involving money or credentials, verify it through another channel. Call the person or talk to them in person.'
          },
          {
            label: 'Report suspicious emails to IT/security',
            details: 'If you receive a suspicious email, do not just delete it. Report it using the "Report Phishing" button in your email client, or forward it to the IT help desk. This helps protect others in the company.'
          }
        ]
      },
      {
        id: 5,
        title: 'Safe Internet and Software Use',
        description: 'Understand the rules of the road for using company computers and accessing the internet.',
        topics: [
          {
            label: 'Do not install unapproved software',
            details: 'Only use software that has been approved and installed by the IT department. Unapproved software can contain malware or create security vulnerabilities on your computer and the network.'
          },
          {
            label: 'Avoid visiting risky or unknown websites',
            details: 'Stick to well-known and reputable websites for work-related tasks. Avoid websites related to illegal activities, gambling, or adult content, as they are often sources of malware.'
          },
          {
            label: 'Only use approved tools for work',
            details: 'Do not use personal email, personal cloud storage, or unapproved chat applications for company business. Keep all work activities within the tools provided and sanctioned by the company.'
          }
        ]
      },
      {
        id: 6,
        title: 'Physical Security Basics',
        description: 'Protecting digital data also means protecting the physical devices and locations where it is stored.',
        topics: [
          {
            label: 'Do not allow tailgating into secure areas',
            details: 'If someone tries to follow you through a badge-controlled door without using their own badge, do not let them. Politely ask them to use their own badge. This prevents unauthorized individuals from gaining access.'
          },
          {
            label: 'Lock your screen when away from your desk',
            details: 'Whenever you leave your computer, even for a moment, lock your screen. Use the keyboard shortcut (Windows Key + L on Windows, Control + Command + Q on Mac). This prevents anyone from accessing your computer while you are away.'
          },
          {
            label: 'Report lost or stolen devices immediately',
            details: 'If your company laptop, phone, or any other device is lost or stolen, report it to IT or your manager immediately. The faster you report it, the faster IT can take steps to protect the data on the device.'
          }
        ]
      },
      {
        id: 7,
        title: 'Handling Incidents',
        description: 'Know what to do if you suspect a security problem.',
        topics: [
          {
            label: 'If you see something unusual, say something',
            details: 'If your computer is acting strangely, you see a suspicious email, or you notice someone in an area where they shouldn\'t be, report it. It is always better to be safe and report a false alarm than to ignore a real threat.'
          },
          {
            label: 'Report incidents right away—do not hide them',
            details: 'If you think you might have clicked on a bad link or made a mistake, report it immediately. Trying to hide a mistake will only make the situation worse and give an attacker more time. We will not punish you for reporting an incident in good faith.'
          },
          {
            label: 'Follow the company’s incident response guidance',
            details: 'Our company has a procedure for handling security incidents. It may involve disconnecting your computer from the network or not turning it off. Follow any instructions from the IT department carefully.'
          }
        ]
      },
      {
        id: 8,
        title: 'Everyday Best Practices',
        description: 'Simple habits that can significantly improve your personal and organizational security.',
        topics: [
          {
            label: 'Think before you click',
            details: 'This is the golden rule of cybersecurity. Before clicking any link, opening any attachment, or entering any information, take a moment to pause and think. Does this seem legitimate? Was I expecting this? A few seconds of caution can prevent a disaster.'
          },
          {
            label: 'Keep work and personal accounts separate',
            details: 'Do not use your work email for personal accounts, and do not use your personal email for work. This separation helps contain the damage if one of your accounts is ever compromised.'
          },
          {
            label: 'Ask if you are unsure how to handle something',
            details: 'There is no such thing as a stupid security question. If you are ever unsure how to handle a piece of information, a suspicious email, or any other security-related situation, ask your manager or the IT department for guidance.'
          }
        ]
      },
      {
        id: 9,
        title: 'Final Reminders',
        description: 'Key takeaways for your role in our collective cybersecurity posture.',
        topics: [
          {
            label: 'Cybersecurity is everyone’s job',
            details: 'Protecting our company from cyber threats is a team sport. Technology and policies are important, but our most effective defense is a vigilant and well-informed workforce. You are a critical part of that defense.'
          },
          {
            label: 'You help protect our contracts and reputation',
            details: 'By following these security practices, you are not just protecting data; you are protecting your coworkers\' jobs and the company\'s future. Our ability to win and keep government contracts depends on our collective security efforts.'
          },
          {
            label: 'When in doubt, ask for guidance',
            details: 'The most important thing to remember is that you are not alone. If you have any questions or concerns about cybersecurity, please do not hesitate to reach out for help. Your vigilance is appreciated and essential.'
          }
        ]
      }
    ]
  }
];
