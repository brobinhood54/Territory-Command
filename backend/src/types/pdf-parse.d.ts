declare module 'pdf-parse' {
  function pdfParse(buffer: Buffer, options?: unknown): Promise<{ text: string; numpages: number; info: unknown }>;
  export = pdfParse;
}
