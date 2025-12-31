import Image from "next/image";
import Link from "next/link";

const contributors = [
  {
    name: "Rohit",
    handle: "@0fficialRohit",
    image: "/images/0fficialRohit.jpg",
    url: "https://x.com/0fficialRohit",
  },
  {
    name: "Rege",
    handle: "@rege_dev",
    image: "/images/rege_dev.jpg",
    url: "https://x.com/rege_dev",
  },
];

export function TocFooter() {
  return (
    <aside
      className="mt-6 border-t border-fd-border pt-4"
      aria-label="Connect with maintainers"
    >
      <p className="mb-3 text-xs font-medium text-fd-muted-foreground">
        Have ideas? Let&apos;s build together
      </p>
      <nav aria-label="Maintainer profiles" className="flex flex-col gap-2">
        {contributors.map((contributor) => (
          <Link
            key={contributor.handle}
            href={contributor.url}
            target="_blank"
            rel="noopener"
            title={`Follow ${contributor.name} on X - Copilot SDK maintainer`}
            aria-label={`Follow ${contributor.name} (${contributor.handle}) on X`}
            className="flex items-center gap-2 rounded-md border border-fd-border bg-fd-card px-3 py-2 text-sm transition-colors hover:bg-fd-accent"
          >
            <Image
              src={contributor.image}
              alt={`${contributor.name} - Copilot SDK maintainer`}
              width={24}
              height={24}
              className="rounded-full"
            />
            <span className="text-fd-foreground">{contributor.handle}</span>
            <svg
              viewBox="0 0 24 24"
              className="ml-auto h-3.5 w-3.5 fill-fd-muted-foreground"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
