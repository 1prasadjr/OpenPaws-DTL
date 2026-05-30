export const reviewQueue = [
  {
    id: 'rev-01',
    initials: 'ER',
    name: 'Eleanor Roosevelt',
    role: 'Major Donor',
    amount: '$25,000.00',
    campaign: 'End of Year 2024',
    confidence: 'High',
    tone: 'Formal',
    status: 'ready',
  },
  {
    id: 'rev-02',
    initials: 'JM',
    name: 'James Madison',
    role: 'Returning Donor',
    amount: '$1,500.00',
    campaign: 'Annual Fund',
    confidence: 'Medium',
    tone: 'Warm',
    status: 'review',
  },
  {
    id: 'rev-03',
    initials: 'SW',
    name: 'Sarah Walker',
    role: 'First-time Donor',
    amount: '$10,000.00',
    campaign: 'Unrestricted',
    confidence: 'Uncertain',
    tone: 'Needs verification',
    status: 'flagged',
  },
  {
    id: 'rev-04',
    initials: 'TB',
    name: 'Thomas Builder',
    role: 'Corporate Match',
    amount: '$5,000.00',
    campaign: 'Capital Campaign',
    confidence: 'High',
    tone: 'Concise',
    status: 'ready',
  },
];

export const draftPreview = {
  donation: {
    amount: '$25,000.00',
    date: 'Oct 24, 2023',
    designation: 'Clean Water Initiative - Sub-Saharan Africa',
  },
  donor: {
    initials: 'AS',
    name: 'Dr. Amelia Sterling',
    lifetime: '$145,000',
    notes: [
      'Attended Annual Gala (2022, 2023)',
      'Prefers detailed impact reports.',
      'Recent note: "Excited about the new well project."',
    ],
  },
  reasoning: {
    summary:
      'The draft leans formal and grounded, with a specific nod to the well project and the donor\'s long-term relationship with the organization.',
    tags: ['Well Project Mention', 'Impact Metric Ref', 'Gala Callback'],
  },
  subject: 'Thank you for your generous support of the Clean Water Initiative',
  body: `Dear Dr. Sterling,

I am writing to express my deepest gratitude for your incredibly generous recent contribution of $25,000 to our Clean Water Initiative.

Your continued support, especially following our wonderful conversations at the recent Annual Gala, is vital to our mission. I recall your specific excitement regarding the new well project in Sub-Saharan Africa. I am thrilled to share that your gift will directly fund the final phase of construction for three new community wells, bringing clean, accessible water to over 1,500 individuals.

We are currently compiling a detailed impact report on the early stages of this project, and I will ensure a copy is sent to you personally next month.

Thank you once again for your remarkable dedication and for sharing our vision of a world with clean water for all.

Warmest regards,

[Sender Name]
Director of Development
Global Giving`,
};
