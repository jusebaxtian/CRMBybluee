import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);

// WhatsApp's Cloud API only accepts H.264 video + AAC audio inside an MP4
// container. Phones (especially iPhone) commonly default to HEVC/H.265,
// which uploads and even "sends" successfully but Meta rejects during its
// own processing step with a codec error — disconnected from the moment
// the file was picked. Re-encoding every video to H.264/AAC up front
// guarantees compatibility regardless of the source codec/container.
export async function transcodeVideoToH264(buffer: Buffer, sourceExt: string): Promise<Buffer> {
  const id = crypto.randomUUID();
  const inPath = path.join(tmpdir(), `${id}-in.${sourceExt || "mp4"}`);
  const outPath = path.join(tmpdir(), `${id}-out.mp4`);
  await writeFile(inPath, buffer);
  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        inPath,
        "-c:v",
        "libx264",
        "-profile:v",
        "main",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "veryfast",
        "-crf",
        "26",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        // Moves the moov atom to the front so WhatsApp/players can start
        // reading the file before it's fully downloaded.
        "-movflags",
        "+faststart",
        outPath,
      ],
      { maxBuffer: 1024 * 1024 * 50 }
    );
    return await readFile(outPath);
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
