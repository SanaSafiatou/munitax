import Link from "next/link";

export function IconeMarque({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 21V10l3-2 5-3.5L17 8l3 2v11M9 21v-4h6v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5V9m-3 1.5h.01M15 10.5h.01M9 14h.01M15 14h.01" />
    </svg>
  );
}

export default function LogoMarque({
  href = "/",
  surFondFonce = false,
}: {
  href?: string;
  surFondFonce?: boolean;
}) {
  return (
    <Link href={href} className="flex items-center gap-2.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          surFondFonce ? "bg-white/15 text-white" : "bg-emerald-700 text-white"
        }`}
      >
        <IconeMarque className="h-5.5 w-5.5" />
      </span>
      <span className="leading-tight">
        <span className={`block text-base font-bold tracking-tight ${surFondFonce ? "text-white" : "text-slate-900"}`}>
          MuniTax
        </span>
        <span className={`block text-[11px] ${surFondFonce ? "text-emerald-100" : "text-slate-500"}`}>
          Taxes municipales
        </span>
      </span>
    </Link>
  );
}
