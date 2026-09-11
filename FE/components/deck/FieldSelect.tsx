"use client";

import { useId } from "react";
import { Select } from "@/components/ui/Select";

// A labelled field dropdown with a sample value preview. Shared by the paste-
// import field confirmation (FieldDetector) and the .apkg trial setup
// (ApkgQuizSetup) so both pick question/answer fields the same way.
//
// The dropdown itself is the shared `Select` primitive — this only adds the
// label above and the "e.g. …" sample below. Reach for `Select` directly for any
// other dropdown; never a native <select>.
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
  const labelId = useId();

  return (
    <div className="space-y-1.5">
      <label id={labelId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <Select
        value={value}
        options={fields.map((f) => ({ value: f, label: f }))}
        onChange={onChange}
        ariaLabelledBy={labelId}
        placeholder="Select a field"
        fullWidth
      />
      <p className="truncate text-xs text-faint" title={sample}>
        e.g. {sample}
      </p>
    </div>
  );
}
