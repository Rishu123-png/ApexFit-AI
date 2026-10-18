/**
 * Deterministic safety triage for Apex Coach.
 *
 * This is intentionally narrow: it only short-circuits situations where a
 * generated coaching answer would be inappropriate. It is not a diagnosis
 * tool and never decides whether somebody is medically safe to exercise.
 */
export type CoachSafetyResult =
  | { kind: 'urgent'; reply: string }
  | { kind: 'pain-or-illness'; reply: string }
  | { kind: 'unsafe-restriction'; reply: string }
  | null;

const URGENT_PATTERN = /\b(chest pain|trouble breathing|cannot breathe|difficulty breathing|passed out|fainted|seizure|severe allergic|face (?:is )?swelling|suicid(?:e|al)|kill myself|self[- ]?harm)\b/i;
const PAIN_OR_ILLNESS_PATTERN = /\b(injur(?:y|ed)|sharp pain|joint pain|back pain|knee pain|ankle pain|dizz(?:y|iness)|lightheaded|fever|vomit(?:ing)?|pregnan(?:t|cy))\b/i;
const RESTRICTION_PATTERN = /\b(starv(?:e|ing)|not eat(?:ing)?|skip(?:ping)? (?:all )?meals|zero calories|water fast|dehydrat(?:e|ing)|purge|laxative|make myself sick|lose \d{2,} ?kg (?:in|this) (?:a |one )?week)\b/i;

const URGENT_REPLY = `I’m sorry you’re dealing with that. Please stop exercising and seek urgent medical help now. If you may be in immediate danger, contact your local emergency service or a trusted person nearby. Apex Coach cannot assess emergencies.`;
const PAIN_REPLY = `Please pause the workout and do not push through pain, dizziness, fever, or illness. Rest, use a comfortable low-impact option only if you feel well, and speak with a qualified clinician or physiotherapist if symptoms are severe, persistent, or getting worse. I can help you choose a gentle, non-medical alternative after you are safe.`;
const RESTRICTION_REPLY = `I can’t help with starvation, purging, dehydration, or rapid weight-loss tactics. These can be dangerous. Please choose regular meals, hydration, and a gradual plan with support from a qualified clinician or dietitian. If you feel at risk of harming yourself, contact local emergency services or a trusted person now.`;

export function coachSafetyCheck(message: string): CoachSafetyResult {
  if (URGENT_PATTERN.test(message)) return { kind: 'urgent', reply: URGENT_REPLY };
  if (RESTRICTION_PATTERN.test(message)) return { kind: 'unsafe-restriction', reply: RESTRICTION_REPLY };
  if (PAIN_OR_ILLNESS_PATTERN.test(message)) return { kind: 'pain-or-illness', reply: PAIN_REPLY };
  return null;
}
