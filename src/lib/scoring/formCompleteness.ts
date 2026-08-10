export function missingScoreFieldNames(formData: FormData, fieldNames: string[]) {
  return fieldNames.filter((fieldName) => {
    const value = formData.get(fieldName);
    return typeof value !== "string" || value.trim() === "";
  });
}
