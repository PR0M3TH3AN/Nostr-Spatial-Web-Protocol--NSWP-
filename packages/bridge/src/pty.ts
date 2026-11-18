/**
 * A real terminal for a program to run in.
 *
 * Node can't make one by itself without a compiled add-on, and Python can, so
 * a few lines of Python hold the terminal and pass bytes each way. What the
 * visitor types comes in on its standard input, what the program writes goes
 * out on its standard output, and a third pipe carries the panel's size.
 */
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";

const HELPER = String.raw`
import fcntl, os, pty, select, signal, struct, sys, termios, time

def size(fd, cols, rows):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))

def put(fd, data):
    while data:
        data = data[os.write(fd, data):]

cols, rows = int(sys.argv[1]), int(sys.argv[2])
argv = sys.argv[3:]
pid, master = pty.fork()
if pid == 0:
    try:
        size(0, cols, rows)
    except OSError:
        pass
    try:
        os.close(3)
    except OSError:
        pass
    os.environ["TERM"] = "xterm-256color"
    os.environ["COLORTERM"] = "truecolor"
    try:
        os.execvp(argv[0], argv)
    except OSError as e:
        os.write(2, ("could not start %s: %s\r\n" % (argv[0], e)).encode())
        os._exit(127)

watch = [0, 3, master]
control = b""
while True:
    try:
        ready, _, _ = select.select(watch, [], [])
    except InterruptedError:
        continue
    if master in ready:
        try:
            data = os.read(master, 16384)
        except OSError:
            data = b""
        if not data:
            break
        put(1, data)
    if 0 in ready:
        data = os.read(0, 65536)
        if not data:
            break
        try:
            put(master, data)
        except OSError:
            break
    if 3 in ready:
        data = os.read(3, 4096)
        if not data:
            watch.remove(3)
        control += data
        while b"\n" in control:
            line, control = control.split(b"\n", 1)
            try:
                c, r = line.split()
                size(master, int(c), int(r))
            except (ValueError, OSError):
                pass

# The program ended, or the Bridge let go: hang up, and don't wait for ever.
try:
    os.kill(pid, signal.SIGHUP)
except OSError:
    pass
os.close(master)
status = None
for _ in range(40):
    done, status = os.waitpid(pid, os.WNOHANG)
    if done:
        break
    status = None
    time.sleep(0.05)
if status is None:
    try:
        os.kill(pid, signal.SIGKILL)
    except OSError:
        pass
    _, status = os.waitpid(pid, 0)
code = os.waitstatus_to_exitcode(status)
sys.exit(code if code >= 0 else 128 - code)
`;

export interface Terminal {
  /** What the visitor typed. */
  write(data: Uint8Array): void;
  resize(cols: number, rows: number): void;
  /** Stop reading what the program writes, while the other end catches up. */
  pause(): void;
  resume(): void;
  /** Hang up. The program is told, then stopped if it doesn't listen. */
  close(): void;
}

export interface TerminalOptions {
  command: string[];
  cwd?: string;
  cols: number;
  rows: number;
  onData(data: Buffer): void;
  onExit(code: number): void;
  python?: string;
}

export function openTerminal(o: TerminalOptions): Terminal {
  // -I: the helper runs with nothing of the caller's Python settings. The program it starts still gets the whole environment.
  const child = spawn(o.python ?? "python3", ["-I", "-c", HELPER, String(o.cols), String(o.rows), ...o.command], {
    ...(o.cwd ? { cwd: o.cwd } : {}),
    stdio: ["pipe", "pipe", "inherit", "pipe"],
  }) as unknown as ChildProcessByStdio<Writable, Readable, null>;
  // The fourth pipe: the panel's size, a line at a time.
  const control = (child.stdio as unknown as Writable[])[3]!;
  let over = false;
  const end = (code: number) => {
    if (over) return;
    over = true;
    o.onExit(code);
  };
  child.stdout.on("data", (data: Buffer) => o.onData(data));
  child.on("error", () => end(127));
  child.on("exit", (code, signal) => end(code ?? (signal ? 129 : 1)));
  for (const pipe of [child.stdin, control]) pipe.on("error", () => undefined); // the program went first
  return {
    write: (data) => void (!over && child.stdin.write(data)),
    resize: (cols, rows) => void (!over && control.write(`${cols} ${rows}\n`)),
    pause: () => void child.stdout.pause(),
    resume: () => void child.stdout.resume(),
    close() {
      if (over) return;
      child.stdin.end();
      // The helper hangs up and waits two seconds; this is for a helper that has itself stuck.
      setTimeout(() => !over && child.kill("SIGKILL"), 4000).unref();
    },
  };
}
