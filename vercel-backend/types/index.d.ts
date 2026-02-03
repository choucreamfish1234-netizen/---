declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }
  function pdf(dataBuffer: Buffer, options?: any): Promise<PDFData>;
  export = pdf;
}

declare module 'mammoth' {
  interface ExtractRawTextResult {
    value: string;
    messages: any[];
  }
  interface Options {
    buffer?: Buffer;
    path?: string;
  }
  function extractRawText(options: Options): Promise<ExtractRawTextResult>;
  export { extractRawText };
}
