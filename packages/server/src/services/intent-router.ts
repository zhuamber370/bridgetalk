import { INTENT_PATTERNS, NEW_TASK_KEYWORDS } from '@openclaw/shared';
import type { IntentScore } from '@openclaw/shared';

export class IntentRouter {
  scoreIntent(content: string): IntentScore {
    let maxScore = 0;
    let matchedIntent = 'general';

    for (const pattern of INTENT_PATTERNS) {
      const matchCount = pattern.keywords.filter(kw => content.includes(kw)).length;
      if (matchCount === 0) continue;

      const score = (matchCount / pattern.keywords.length) * (1 + pattern.confidenceBoost);
      if (score > maxScore) {
        maxScore = score;
        matchedIntent = pattern.intent;
      }
    }

    return {
      matched: maxScore > 0.3,
      confidence: Math.min(maxScore, 0.95),
      intent: matchedIntent,
    };
  }

  isNewTaskIntent(content: string): boolean {
    return NEW_TASK_KEYWORDS.some(kw => content.includes(kw));
  }

  shouldCreateNewTask(content: string, hasActiveTask: boolean): { createNew: boolean; askUser: boolean } {
    if (this.isNewTaskIntent(content)) {
      return { createNew: true, askUser: false };
    }

    if (!hasActiveTask) {
      return { createNew: true, askUser: false };
    }

    const score = this.scoreIntent(content);
    if (score.confidence < 0.7) {
      return { createNew: false, askUser: true };
    }

    return { createNew: false, askUser: false };
  }
}
