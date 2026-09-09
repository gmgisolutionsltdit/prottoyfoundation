import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { getAttachmentSignedUrl } from "@/lib/uploadAttachment";

// getAttachmentSignedUrl returns null both while nothing has happened yet and
// when the request failed, so the components below track the request state
// explicitly. Without that, a denied request (e.g. a role without storage
// read access) is indistinguishable from "still loading" and the UI sits on a
// loading placeholder forever.
type State = "loading" | "ready" | "failed";

function useSignedUrl(stored: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let alive = true;
    if (!stored) {
      setUrl(null);
      setState("ready");
      return;
    }
    setState("loading");
    getAttachmentSignedUrl(stored)
      .then((u) => {
        if (!alive) return;
        setUrl(u);
        setState(u ? "ready" : "failed");
      })
      .catch(() => {
        if (alive) setState("failed");
      });
    return () => {
      alive = false;
    };
  }, [stored]);

  return { url, state };
}

export function AttachmentThumb({ stored }: { stored: string | null | undefined }) {
  const { url, state } = useSignedUrl(stored);

  if (!stored) return <span className="text-muted-foreground">—</span>;
  if (state === "loading") return <div className="h-10 w-10 animate-pulse rounded border bg-muted" />;
  if (state === "failed" || !url) {
    return (
      <div
        className="flex h-10 w-10 items-center justify-center rounded border bg-muted text-muted-foreground"
        title="Attachment can't be loaded — you may not have access to it"
      >
        <ImageOff className="h-4 w-4" />
        <span className="sr-only">Attachment unavailable</span>
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title="View attachment">
      <img src={url} alt="" className="h-10 w-10 rounded border object-cover" />
    </a>
  );
}

export function AttachmentViewLink({
  stored,
  children,
}: {
  stored: string | null | undefined;
  children: React.ReactNode;
}) {
  const { url, state } = useSignedUrl(stored);

  if (!stored) return null;
  if (state === "failed") return <span className="text-muted-foreground">unavailable</span>;
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="underline">
      {children}
    </a>
  );
}
