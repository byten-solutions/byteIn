export const ID_PROOF_OPTIONS = [
  "Aadhaar Card",
  "Passport",
  "Driving Licence",
  "Voter ID",
  "PAN Card",
  "Other",
] as const;

/**
 * Returns available ID proof type options, ensuring any legacy or non-standard
 * value currently saved on a guest record is preserved in the dropdown.
 */
export function getIdProofOptions(currentValue?: string | null): string[] {
  const list = [...ID_PROOF_OPTIONS] as string[];
  if (currentValue && currentValue.trim() && !list.includes(currentValue.trim())) {
    list.splice(list.length - 1, 0, currentValue.trim());
  }
  return list;
}
