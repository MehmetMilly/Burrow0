import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { basename } from 'node:path';

// Turn long software-rendered Playwright captures into a practical review artifact.
// Usage: node scripts/review-video.mjs artifacts/playtest/page@....webm [output-directory]
const source = process.argv[2];
if (!source) throw new Error('Provide a Playwright .webm path.');
const output = process.argv[3] ?? 'artifacts/review';
await mkdir(output, { recursive: true });
const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', source], { encoding: 'utf8' }).trim());
if (!Number.isFinite(duration) || duration <= 0) throw new Error('Video has no finite duration.');
const factor = Math.min(1, 45 / duration);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', source, '-vf', `setpts=${factor}*PTS,fps=12,scale=960:-2`, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-movflags', '+faststart', `${output}/review.mp4`], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', source, '-vf', `fps=12/${duration},scale=320:-2,tile=4x3`, '-frames:v', '1', `${output}/contact-sheet.jpg`], { stdio: 'inherit' });
console.log(`${basename(source)}: ${duration.toFixed(1)} s → ${(duration * factor).toFixed(1)} s review; contact sheet and MP4 in ${output}`);
