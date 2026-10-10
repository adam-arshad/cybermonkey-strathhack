export type Category = 'Prevent' | 'Detect' | 'Respond';
export interface Control { id: string; name: string; category: Category; cost: number; description: string; use_case: string; limitation: string }
export interface Phase { id: string; title: string; local_time: string; story: string; scores: Record<string, number> }
export interface Scenario { budget: number; controls: Control[]; phases: Phase[]; already_in_place: { name: string; description: string; why_no_score: string }[] }
export interface ScoreResult { chosen: string[]; budget: number; spent: number; unspent: number; phases: { phaseId: string; score: number; contributions: {id: string; points: number}[] }[]; total: number }
export interface Question { id: string; category: string; question: string; options: Record<string, string>; correct: string; explanation: string; phase_id: string | null }
export interface Tower { uid: string; controlId: string; category: Category; level: number; pad: number | null }
export interface Point { x: number; y: number }
