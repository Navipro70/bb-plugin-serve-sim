// bb-plugin-serve-sim — frontend entry.
//
// Registers a "Simulator (serve-sim)" tab for the thread side panel plus a header button
// that toggles it. The tab starts serve-sim through the server (server.ts) and
// embeds serve-sim's own preview page, which streams the simulator and sends
// touches/keys back over its same-origin WebSocket.
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  definePluginApp,
  experimental_THREAD_ACTION_GROUPS,
  useRealtime,
  useRpc,
} from "@get-bb/plugin-sdk/app";
import type { rpcContract, ServeSimStatus, SimDevice } from "./server";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const STATUS_CHANNEL = "serve-sim-status";
const TAB = { id: "simulator", context: { kind: "thread" }, availability: "action" } as const;

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function useServeSim() {
  const rpc = useRpc<typeof rpcContract>();
  const [status, setStatus] = useState<ServeSimStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refetch = useCallback(() => {
    rpc.call("status").then(
      (next) => {
        setStatus(next);
        setError(null);
      },
      (cause) => setError(errorText(cause)),
    );
  }, [rpc]);
  useEffect(() => {
    refetch();
  }, [refetch]);
  useRealtime(STATUS_CHANNEL, refetch);
  return { rpc, status, error, setError, refetch };
}

function useDevices(enabled: boolean) {
  const rpc = useRpc<typeof rpcContract>();
  const [devices, setDevices] = useState<SimDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    rpc.call("devices").then(
      (result) => {
        setDevices(result.devices);
        setError(result.error);
      },
      (cause) => setError(errorText(cause)),
    );
  }, [rpc]);
  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);
  return { devices, error, reload };
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">{children}</div>
    </div>
  );
}

function Logs() {
  const rpc = useRpc<typeof rpcContract>();
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      rpc.call("logs").then(
        (result) => alive && setLines(result.lines.slice(-12)),
        () => undefined,
      );
    load();
    const timer = setInterval(load, 1500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [rpc]);
  if (lines.length === 0) return null;
  return (
    <pre className="max-h-48 w-full overflow-auto rounded-md border border-border bg-muted/40 p-2 text-left font-mono text-[11px] leading-snug text-muted-foreground">
      {lines.join("\n")}
    </pre>
  );
}

function StartScreen({
  status,
  onStart,
  pending,
}: {
  status: ServeSimStatus;
  onStart: (device: string | null) => void;
  pending: boolean;
}) {
  const { devices, error, reload } = useDevices(true);
  const [device, setDevice] = useState<string>("");
  const booted = devices?.filter((d) => d.state === "Booted") ?? [];
  const starting = status.state === "starting" || pending;

  return (
    <Centered>
      <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted/40">
        <Icon name="Smartphone" className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-medium">iOS Simulator</h2>
        <p className="text-sm text-muted-foreground">
          Streams a simulator into this panel with{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/EvanBacon/serve-sim"
            target="_blank"
            rel="noreferrer"
          >
            serve-sim
          </a>
          . Click to tap, drag to swipe, type to send keys.
        </p>
      </div>

      <div className="flex w-full items-center gap-2">
        <select
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          value={device}
          disabled={starting}
          onChange={(event) => setDevice(event.target.value)}
          aria-label="Simulator"
        >
          <option value="">
            {booted.length > 0 ? `Booted simulator (${booted.map((d) => d.name).join(", ")})` : "Auto (boot default)"}
          </option>
          {devices?.map((d) => (
            <option key={d.udid} value={d.udid}>
              {d.state === "Booted" ? "● " : ""}
              {d.name} — {d.runtime}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="icon" className="size-9" onClick={reload} aria-label="Refresh devices">
          <Icon name="ArrowReloadHorizontal" className="size-4" />
        </Button>
      </div>

      <Button className="w-full" disabled={starting} onClick={() => onStart(device === "" ? null : device)}>
        <Icon name={starting ? "Spinner" : "Play"} className={cn("size-4", starting && "animate-spin")} />
        {starting ? "Starting serve-sim…" : "Start simulator"}
      </Button>

      {status.state === "starting" ? (
        <p className="text-xs text-muted-foreground">
          The first run downloads serve-sim with npx and can take a minute.
        </p>
      ) : null}
      {status.state === "error" && status.error ? (
        <p role="alert" className="text-sm text-destructive">
          {status.error}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {status.state !== "stopped" ? <Logs /> : null}
    </Centered>
  );
}

function SimulatorPanel(_props: { threadId: string; params: unknown }) {
  const { rpc, status, error, setError, refetch } = useServeSim();
  const [pending, setPending] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  const run = async (action: () => Promise<unknown>) => {
    setPending(true);
    try {
      await action();
      refetch();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setPending(false);
    }
  };

  if (status === null) {
    return <Centered>{error ? <p className="text-sm text-destructive">{error}</p> : <p className="text-sm text-muted-foreground">Loading…</p>}</Centered>;
  }

  if (status.state !== "running" || status.url === null) {
    return (
      <StartScreen
        status={status}
        pending={pending}
        onStart={(device) => void run(() => rpc.call("start", { device }))}
      />
    );
  }

  const url = status.url;
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2 text-xs text-muted-foreground">
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono">{url.replace(/^http:\/\//, "")}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Reload preview"
          onClick={() => setFrameKey((key) => key + 1)}
        >
          <Icon name="ArrowReloadHorizontal" className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Open in browser"
          onClick={() => window.open(url, "_blank", "noopener")}
        >
          <Icon name="ExternalLink" className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Stop serve-sim"
          disabled={pending}
          onClick={() => void run(() => rpc.call("stop"))}
        >
          <Icon name="Square" className="size-3.5" />
        </Button>
      </div>
      <iframe
        key={frameKey}
        src={url}
        title="iOS Simulator"
        className="min-h-0 w-full flex-1 border-0 bg-background"
        allow="clipboard-read; clipboard-write; fullscreen; autoplay"
      />
    </div>
  );
}

export default definePluginApp((app) => {
  app.slots.experimental_tab({
    ...TAB,
    title: "Simulator (serve-sim)",
    icon: "Smartphone",
    tooltip: "iOS Simulator (serve-sim)",
    layout: "flush",
    component: SimulatorPanel,
  });

  app.slots.experimental_threadAction({
    id: "open-simulator",
    title: "Simulator (serve-sim)",
    icon: "Smartphone",
    group: experimental_THREAD_ACTION_GROUPS.open,
    placement: "header",
    item: ({ experimental_panel }) => ({
      label: "Simulator (serve-sim)",
      icon: "Smartphone",
      run: () => {
        experimental_panel.toggleTab({ tab: TAB, title: "Simulator (serve-sim)" });
      },
    }),
  });
});
