import type { SVGProps } from "react";

const paths = {
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  sparkles: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4",
  folder: "M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 2h18",
  calendar: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 10h2m4 0h2m-8 4h2",
  menu: "M4 6h16M4 12h16M4 18h16",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  store: "m3 8 2-5h14l2 5M3 8v3a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V8H3Zm1 6v7h16v-7M9 21v-6h6v6",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v5l3 2m7-3a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  edit: "m14 5 5 5m-15 9 4-1L21 5l-4-4L4 14l-1 6 6-1M12 21h9",
  trend: "m3 17 6-6 4 4 8-10m-6 0h6v6",
  message: "M21 11a9 9 0 0 1-9 9H5l-4 3 2-7a9 9 0 1 1 18-5ZM8 10h8m-8 4h5",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  copy: "M9 9h12v12H9ZM5 15H3V3h12v2",
  archive: "M3 3h18v5H3Zm2 5v13h14V8m-9 4h4",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  image: "M3 3h18v18H3Zm0 14 6-6 4 4 3-3 5 5M8 7h.01",
  settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
  info: "M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  carrot: "m14 6 4 4c-1 4-7 9-13 11 2-6 7-12 9-15Zm2-1V2m3 5h3m-4-2 3-3M9 13l2 2",
} as const;

export type IconName = keyof typeof paths;
export default function Icon({ name, size = 20, ...props }: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}><path d={paths[name]} /></svg>;
}
