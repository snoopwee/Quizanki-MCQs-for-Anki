"use client";

// A labelled field dropdown with a sample value preview. Shared by the paste-
// import field confirmation (FieldDetector) and the .apkg trial setup
// (ApkgQuizSetup) so both pick question/answer fields the same way.
export function FieldSelect({
  label,
  value,
  fields,
  sample,
  onChange,
}: {
  label: string;
  value: string;
  fields: string[];
  sample: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-ink">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none"
      >
        {fields.map((f) => (
          <option key={f} value={f} className="bg-surface text-ink">
            {f}
          </option>
        ))}
      </select>
      <p className="truncate text-xs text-faint" title={sample}>
        e.g. {sample}
      </p>
    </div>
  );
}
