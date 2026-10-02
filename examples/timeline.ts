// An event timeline: a lane for each agent, spans and point events, status by color and shape.
import { timeline } from "enarratio";

export default timeline({
  label: "Agent runs, 9 June 2026",
  start: "2026-06-09T00:00:00Z",
  end: "2026-06-09T12:00:00Z",
  lanes: ["Ingest agent", "Analysis agent", "Report agent"],
  events: [
    {
      lane: "Ingest agent",
      label: "Nightly import",
      status: "ok",
      from: "2026-06-09T00:30:00Z",
      to: "2026-06-09T02:15:00Z",
    },
    {
      lane: "Ingest agent",
      label: "Source slow",
      status: "warning",
      from: "2026-06-09T01:00:00Z",
      to: "2026-06-09T01:45:00Z",
    },
    {
      lane: "Ingest agent",
      label: "Morning import",
      status: "ok",
      from: "2026-06-09T08:00:00Z",
      to: "2026-06-09T08:40:00Z",
    },
    {
      lane: "Analysis agent",
      label: "Model run 41",
      status: "ok",
      from: "2026-06-09T02:30:00Z",
      to: "2026-06-09T05:00:00Z",
    },
    {
      lane: "Analysis agent",
      label: "Model run 42 failed",
      status: "error",
      at: "2026-06-09T06:20:00Z",
    },
    {
      lane: "Analysis agent",
      label: "Heartbeat lost",
      status: "unknown",
      from: "2026-06-09T09:00:00Z",
      to: "2026-06-09T10:30:00Z",
    },
    { lane: "Report agent", label: "Weekly report sent", status: "ok", at: "2026-06-09T07:00:00Z" },
    {
      lane: "Report agent",
      label: "Chart refresh retried",
      status: "warning",
      at: "2026-06-09T11:00:00Z",
    },
  ],
});
