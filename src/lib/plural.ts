// Counts in copy: content gives { one, other } forms, each with {count};
// Intl.PluralRules picks the right one, so "1 question" never reads "1 questions".

export interface PluralForms {
  one: string;
  other: string;
}

const rules = new Intl.PluralRules("en");

export function plural(count: number, forms: PluralForms): string {
  return (rules.select(count) === "one" ? forms.one : forms.other).replace("{count}", String(count));
}
