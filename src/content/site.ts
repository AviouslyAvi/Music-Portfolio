// PLACEHOLDER: each default stands in until the real sites exist; set the NEXT_PUBLIC_* env vars to override.
export const LINKS: { premonitionStore: string; premonitionAccount: string; aviousCo: string; demoDownload: string } = {
  premonitionStore: process.env.NEXT_PUBLIC_PREMONITION_URL ?? 'https://premonition.avious.co', // PLACEHOLDER
  premonitionAccount: process.env.NEXT_PUBLIC_PREMONITION_ACCOUNT_URL ?? 'https://premonition.avious.co/account', // PLACEHOLDER
  aviousCo: process.env.NEXT_PUBLIC_AVIOUS_URL ?? 'https://avious.co', // PLACEHOLDER
  demoDownload: process.env.NEXT_PUBLIC_DEMO_DOWNLOAD_URL ?? '/downloads/premonition-demo.zip', // PLACEHOLDER
};
