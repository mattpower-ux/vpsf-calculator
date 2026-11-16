const assessedResultScreens = new Set([4, 5, 6, 9, 10, 17, 18, 19]);

export function resultForCurrentAssessment(resultMode, demoResult, apiResult) {
  return resultMode === "demo" ? demoResult : apiResult;
}

export function requiresAssessmentScore(screen) {
  return assessedResultScreens.has(screen);
}

/** Own the complete async run, including its presentation delay and side effects.
 * Invalidate synchronously at input/navigation boundaries, before React renders.
 */
export function createScoreRequestSession() {
  let revision = 0;
  let active = null;
  return {
    pending: () => active !== null,
    invalidate() { revision++; active = null; },
    async run({input, request, onSuccess, onError, onFinish, minimumDelay = 0,
      wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))}) {
      const token = {revision, input};
      active = token; // A newer run wins even for the same input revision.
      const current = () => active === token && revision === token.revision;
      const startedAt = Date.now();
      let result, failure, succeeded = false;
      try { result = await request(input); succeeded = true; }
      catch (error) { failure = error; }
      if (!current()) return;
      const remaining = minimumDelay - (Date.now() - startedAt);
      if (remaining > 0) await wait(remaining);
      if (!current()) return;
      // Commit result, tracking and navigation together, after every await.
      active = null;
      if (succeeded) onSuccess(result, token.input);
      else onError(failure);
      onFinish(succeeded);
    }
  };
}
