# ApexFit fitness-product research and redesign

## What the comparison shows

Nike Training Club emphasizes quick workout choices, goal-setting, progressive programs, scheduling, and guidance across training, nutrition, recovery, and mindset. The useful pattern for ApexFit is not simply “more exercises”; it is a clear programme that tells a beginner what to do today and why. [1]

Fitbod makes personalization tangible by adapting workouts to goals, fitness level, available equipment, logged performance, recovery, and progressive overload. It also treats expert demonstrations and form cues as essential for beginners. ApexFit currently has profile-based plan selection, but it needs clearer progression and better instruction before the first set. [2]

Freeletics positions an AI coach as a conversational layer for technique, performance, and training adaptations. The relevant lesson is to keep coaching contextual: answer the user’s current exercise question rather than burying guidance in a generic assistant. [3]

For pain and injury risk, ACE emphasizes that overuse problems can be linked to technique, biomechanics, sudden training changes, and repetitive loading. Persistent symptoms should be assessed by a qualified professional; training volume and impact may need to be reduced. ApexFit must therefore surface “stop if pain” and low-impact substitutions, and must never present camera feedback as a medical clearance. [4]

## ApexFit code audit findings

1. **Loading is still network-first in several paths.** Dashboard and onboarding depend on Realtime Database listeners before they show useful content. Arena waits for a server profile request. The pose engine downloads runtime and model files from external URLs. These paths need explicit timeouts, cached local fallbacks, and actionable retry states.

2. **The workout is honest about self-reporting but still too easy to mark manually.** `SessionRunner` increments a set from a button. The server seal checks time, plan structure, and set counts, but it cannot prove that movement happened. That means XP must be separated from private self-reported history. Camera guidance can improve confidence, but it cannot prove safety or effort by itself.

3. **The current motion guide is too abstract for a beginner.** It shows one small generic stick figure and a short cue. A new user needs a large start position, a large end position, directional arrows, one change at a time, common mistakes, a low-impact substitute, and a “watch / practise / start” sequence.

4. **Camera coaching is currently narrow.** It tracks a small set of knee/elbow angles and visibility. That is a good conservative foundation, but it should clearly distinguish “camera cannot see you,” “movement cue,” “rep counted,” and “pain or discomfort: stop.” It should not claim that an angle means the exercise is safe.

## Implementation direction

ApexFit should become offline-first for the core workout: the exercise library, plan, animations, timer, rest timer, set log, and recovery of an interrupted session should work without a network. Sync, server verification, Arena XP, and AI food analysis should be progressive enhancements with visible status. Camera pose guidance should remain opt-in, local, and explicit; when unavailable, the app should offer a low-impact self-report path but not award verified XP.

The next UI iteration should use exercise-specific teaching cards rather than one generic animation. The visual sequence should show setup, descent/press/hinge, and return. The camera panel should use large, plain-language feedback and should not count a rep while the required joints are not visible.

## References

[1]: https://www.nike.com/ntc-app "Nike Training Club official app page"
[2]: https://fitbod.me/ "Fitbod official product and FAQ page"
[3]: https://www.freeletics.com/en/blog/posts/freeletics-coach-plus/ "Freeletics Coach+ official product article"
[4]: https://www.acefitness.org/resources/everyone/blog/5160/how-to-prevent-shin-splints/ "ACE exercise safety and shin-splint prevention guidance"
