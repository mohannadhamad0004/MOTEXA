import { VerticalTimeline } from "../blueprint/route";

/** One line per step that happened, with its time. The last step is the current one. */
export function StatusTimeline({ items }: { items: { key: string; label: string; at: string }[] }) {
  return (
    <VerticalTimeline
      items={items.map((it, i) => ({ key: it.key, label: it.label, at: it.at, state: i === items.length - 1 ? "now" : "done" }))}
    />
  );
}
