export function convertFilename(text: string) {
  // convert space to dash and make it lowercase and if the space is more than one, replace it with a single dash
  return text.trim().toLowerCase().replaceAll(/\s+/g, '-');
}
