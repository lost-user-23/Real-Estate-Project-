// Per-property save/unsave synchronisation, kept free of React so it can be
// reasoned about (and tested) on its own.
//
// For every property id it tracks two values:
//   confirmed: the last state the server acknowledged
//   desired:   what the user most recently asked for
// At most one request per id is in flight. When it finishes and desired still
// differs from confirmed, exactly one more request is sent, so rapid toggling
// collapses into the final state. A failed request rolls the id back to
// confirmed, never to "the opposite of what was sent".
//
// send(id, saved)      performs the request and rejects on failure
// onChange(id, saved)  the UI state for an id changed (optimistic or rollback)
// onSaved(id)          a save request was confirmed by the server
// onFailure(id)        a request failed and the id was rolled back
export function createSavedSync({ send, onChange, onSaved = () => {}, onFailure = () => {} }) {
  const entries = new Map();
  // Bumped by reset() so requests that were in flight at logout are ignored.
  let epoch = 0;

  const entryFor = (id) => {
    if (!entries.has(id)) entries.set(id, { confirmed: false, desired: false, inFlight: false });
    return entries.get(id);
  };

  async function pump(id) {
    const entry = entryFor(id);
    if (entry.inFlight) return;
    const startEpoch = epoch;
    entry.inFlight = true;

    try {
      while (entry.desired !== entry.confirmed) {
        const wanted = entry.desired;
        try {
          await send(id, wanted);
        } catch {
          if (epoch !== startEpoch) return;
          entry.desired = entry.confirmed;
          onChange(id, entry.confirmed);
          onFailure(id);
          return;
        }
        if (epoch !== startEpoch) return;
        entry.confirmed = wanted;
        if (wanted) onSaved(id);
      }
    } finally {
      // After reset() the entry object is orphaned; a fresh one may exist, leave it alone.
      if (epoch === startEpoch) entry.inFlight = false;
    }
  }

  function set(id, saved) {
    const entry = entryFor(id);
    entry.desired = saved;
    onChange(id, saved);
    return pump(id);
  }

  return {
    // Current wanted state, read from here rather than from a render closure.
    isSaved: (id) => entries.get(id)?.desired ?? false,

    set,

    toggle: (id) => set(id, !(entries.get(id)?.desired ?? false)),

    // Merge the server's list in as a union: nothing is removed, and an id the
    // user has since changed locally keeps the user's choice.
    hydrate(ids) {
      for (const id of ids) {
        const entry = entryFor(id);
        const untouched = entry.desired === entry.confirmed;
        entry.confirmed = true;
        if (untouched && !entry.desired) {
          entry.desired = true;
          onChange(id, true);
        }
      }
    },

    // Logout: forget everything and ignore any request still in flight.
    reset() {
      epoch += 1;
      entries.clear();
    },
  };
}
