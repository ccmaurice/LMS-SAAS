"use client";

import { useEffect, useRef } from "react";

/**
 * Optional hooks: logs window blur and fullscreen exit to the proctoring API (no webcam).
 */
export function AssessmentProctorHooks(props: {
  assessmentId: string;
  submissionId: string | null;
  enabled?: boolean;
}) {
  const enabled = props.enabled !== false;
  const submissionIdRef = useRef(props.submissionId);

  useEffect(() => {
    submissionIdRef.current = props.submissionId;
  }, [props.submissionId]);

  useEffect(() => {
    if (!enabled) return;

    const post = (eventType: string, payload?: Record<string, unknown>) => {
      const sid = submissionIdRef.current;
      void fetch(`/api/assessments/${props.assessmentId}/proctoring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          eventType,
          submissionId: sid,
          payload: payload ?? undefined,
        }),
      }).catch(() => {});
    };

    const onBlur = () => post("window_blur");
    const onVis = () => {
      if (document.visibilityState === "hidden") post("document_hidden");
    };
    const onFs = () => {
      if (!document.fullscreenElement) post("fullscreen_exit");
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);

    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [enabled, props.assessmentId]);

  return null;
}
