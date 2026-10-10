// Phases 1–3 follow the scenario PowerPoint, slides 5, 6 and 8.
// Phase 4 is the agreed custom encryption/ransom board.
// Each row is Prevent, Detect, Respond; columns award 3, 2, 1 points.
export const MATCH_BOARDS = [
  [["P6", "P7", "P1"], ["D1", "D6", "D2"], ["R2", "R1", "R3"]],
  [["P2", "P4", "P8"], ["D6", "D1", "D5"], ["R2", "R1", "R6"]],
  [["P5", "P4", "P2"], ["D6", "D7", "D1"], ["R2", "R1", "R6"]],
  [["P9", "P2", "P5"], ["D6", "D1", "D2"], ["R4", "R1", "R2"]],
] as const;

export const PHASE_STORIES = [
  {
    title: "Delivery & exploitation",
    paragraphs: [
      "An employee receives a phishing email that appears to be from a trusted source.",
      "The email contains a link that, when clicked, downloads unknown malicious software onto the employee’s computer.",
    ],
  },
  {
    title: "Discovery",
    paragraphs: [
      "The malicious software is installed on the employee’s computer at 2am.",
      "The hackers use this software to discreetly carry out discovery of information on the company network, identifying valuable targets.",
    ],
  },
  {
    title: "Command & control",
    paragraphs: [
      "The hackers perform searches on critical applications and software, gaining remote control through command-and-control methods.",
      "They gather information about the network and its vulnerabilities.",
    ],
  },
  {
    title: "Encryption & ransom",
    paragraphs: [
      "The hackers discover important company data files and begin to encrypt (lock) them.",
      "They demand a ransom payment for the decryption key.",
    ],
  },
];

export function matchPoints(phase: number, id: string): number {
  const index = MATCH_BOARDS[phase]?.flat().findIndex((card) => card === id) ?? -1;
  return index < 0 ? 0 : 3 - (index % 3);
}
