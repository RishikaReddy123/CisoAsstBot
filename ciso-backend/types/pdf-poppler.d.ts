declare module "pdf-poppler" {
  export function convert(
    inputFile: string,
    options: {
      out_dir: string;
      out_prefix?: string;
      format?: string;
      page?: number;
      dpi?: number;
    }
  ): Promise<void>;
}
