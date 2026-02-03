import { IS_BUN } from "./detect";

interface SpawnResult {
  stdout: string;
  exitCode: number | null;
}

export async function spawnCommand(
  cmd: string,
  args: string[],
  options: { cwd?: string } = {}
): Promise<SpawnResult> {
  if (IS_BUN) {
    const proc = Bun.spawn([cmd, ...args], {
      cwd: options.cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    return { stdout, exitCode };
  } else {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);
    try {
      const result = await execFileAsync(cmd, args, { cwd: options.cwd, maxBuffer: 10 * 1024 * 1024 });
      return { stdout: result.stdout, exitCode: 0 };
    } catch (err: any) {
      return { stdout: err.stdout ?? "", exitCode: err.code ?? 1 };
    }
  }
}
