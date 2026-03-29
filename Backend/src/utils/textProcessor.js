export const cleanText = (text) => {
  return text
    .replace(/\r\n/g, "\n")          // normalize line breaks
    .replace(/\n+/g, "\n")           // remove extra new lines
    .replace(/\s+/g, " ")            // remove extra spaces
    .trim();
};
export const chunkText = (text, chunkSize = 1000) => {
  const words = text.split(" ");
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    chunks.push(chunk);
  }

  return chunks;
};