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
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
      >
        {fields.map((f) => (
          <option
            key={f}
            value={f}
            className="bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {f}
          </option>
        ))}
      </select>
      <p className="truncate text-xs text-neutral-500" title={sample}>
        e.g. {sample}
      </p>
    </div>
  );
}
