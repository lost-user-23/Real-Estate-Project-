"use client";

import { useCallback, useEffect, useState } from "react";

export function useSectionData(fetcher) {
  const [state, setState] = useState({ status: "loading", data: null });

  const load = useCallback(() => {
    setState({ status: "loading", data: null });
    fetcher()
      .then((data) => setState({ status: "success", data }))
      .catch(() => setState({ status: "error", data: null }));
  }, [fetcher]);

  useEffect(() => {
    // Kicks off the mock fetch on mount / whenever the fetcher identity
    // changes (e.g. the debugError query param); `load` itself owns the
    // loading/success/error state transitions.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { ...state, retry: load };
}
