#!/usr/bin/env bash
#
# Build an H.264 MP4 from the step-*.png screenshots of an automated run.
#
# Each screenshot is held for a fixed duration (5s by default). Subtitles come either from a
# caption file (-c, one line per screenshot, recommended) or, failing that, from the run title and
# the step filenames. Burn-in needs an ffmpeg built with libass; pass -s to get a soft mov_text
# track instead.
#
# Usage:
#   steps-to-video.sh [run-dir] [options]
#
#   run-dir           directory holding step-*.png (default: newest .debug/automated-run/*)
#
# Options:
#   -c FILE           caption file: one subtitle per screenshot, in step order. Blank lines and
#                     lines starting with # are ignored, leading "1." / "1)" numbering is stripped,
#                     and a literal \n splits a caption over two lines. The line count must match
#                     the number of screenshots.
#   -d SECONDS        seconds per frame (default 5)
#   -o FILE           output file (default <run-dir>/steps.mp4)
#   -t TITLE          run title (default: first heading of <run-dir>/run-plan.md)
#   -H PIXELS         video height; width follows the source aspect ratio (default 1080)
#   -f FPS            output frame rate (default 30)
#   -s                soft subtitles (mov_text track) instead of burning them in
#   -h                show this help
#
# Requires: sips, and ffmpeg. For burn-in the ffmpeg must have the subtitles filter (libass),
# e.g. `brew install ffmpeg-full`; set FFMPEG=/path/to/ffmpeg to pick a specific binary.

set -euo pipefail

DURATION=5
OUTPUT=
TITLE=
HEIGHT=1080
FPS=30
RUN_DIR=
CAPTIONS=
SOFT=0
BG=0x1c2029   # letterbox colour

# Print the comment header, minus the shebang, as the help text.
usage() { awk 'NR>1 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "$0"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    -c) CAPTIONS=$2; shift 2 ;;
    -d) DURATION=$2; shift 2 ;;
    -o) OUTPUT=$2; shift 2 ;;
    -t) TITLE=$2; shift 2 ;;
    -H) HEIGHT=$2; shift 2 ;;
    -f) FPS=$2; shift 2 ;;
    -s) SOFT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
    *) RUN_DIR=$1; shift ;;
  esac
done

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

if [[ -z "$RUN_DIR" ]]; then
  RUN_DIR=$(ls -1d "$repo_root"/.debug/automated-run/*/ 2>/dev/null | sort | tail -1 || true)
  [[ -n "$RUN_DIR" ]] || { echo "no run directory found under .debug/automated-run/" >&2; exit 1; }
fi
RUN_DIR=${RUN_DIR%/}
[[ -d "$RUN_DIR" ]] || { echo "not a directory: $RUN_DIR" >&2; exit 1; }
# Absolute, because the concat demuxer resolves relative paths against the list file.
RUN_DIR=$(cd "$RUN_DIR" && pwd)

command -v sips >/dev/null || { echo "sips not found (macOS only)" >&2; exit 1; }

# Prefer an ffmpeg that has the subtitles filter (libass), so titles can be burned in.
# The filter list is captured first: piping it into `grep -q` races, because grep exits on the
# match and the resulting SIGPIPE trips `pipefail` even though the filter is present.
has_libass() {
  local filters
  filters=$("$1" -hide_banner -filters 2>/dev/null) || return 1
  grep -qE '^ ..[[:space:]]+subtitles\b' <<<"$filters"
}
FFMPEG=${FFMPEG:-}
if [[ -n "$FFMPEG" ]]; then
  command -v "$FFMPEG" >/dev/null || { echo "FFMPEG not executable: $FFMPEG" >&2; exit 1; }
else
  for candidate in /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg /usr/local/opt/ffmpeg-full/bin/ffmpeg ffmpeg; do
    command -v "$candidate" >/dev/null || continue
    FFMPEG=$candidate
    has_libass "$candidate" && break
  done
fi
[[ -n "$FFMPEG" ]] || { echo "ffmpeg not found" >&2; exit 1; }

if [[ $SOFT -eq 0 ]] && ! has_libass "$FFMPEG"; then
  echo "error: $FFMPEG has no subtitles filter (no libass), so subtitles cannot be burned in." >&2
  echo "       install a full build (brew install ffmpeg-full), set FFMPEG=/path/to/ffmpeg," >&2
  echo "       or pass -s for a soft mov_text track." >&2
  exit 1
fi

shots=()
while IFS= read -r shot; do shots+=("$shot"); done < <(
  find "$RUN_DIR" -maxdepth 1 -name 'step-*.png' | sort -t- -k2 -n
)
[[ ${#shots[@]} -gt 0 ]] || { echo "no step-*.png files in $RUN_DIR" >&2; exit 1; }

captions=()
if [[ -n "$CAPTIONS" ]]; then
  [[ -f "$CAPTIONS" ]] || { echo "caption file not found: $CAPTIONS" >&2; exit 1; }
  while IFS= read -r line || [[ -n "$line" ]]; do
    line=${line%$'\r'}
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    line=$(sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^[0-9]\{1,\}[.)][[:space:]]*//' <<<"$line")
    captions+=("$line")
  done < "$CAPTIONS"
  if [[ ${#captions[@]} -ne ${#shots[@]} ]]; then
    echo "error: $CAPTIONS has ${#captions[@]} captions but $RUN_DIR has ${#shots[@]} screenshots." >&2
    echo "       write one caption per screenshot, in step order:" >&2
    for shot in "${shots[@]}"; do echo "         $(basename "$shot")" >&2; done
    exit 1
  fi
fi

[[ -n "$TITLE" ]] || TITLE=$(sed -n 's/^# *//p' "$RUN_DIR/run-plan.md" 2>/dev/null | head -1 || true)
TITLE=${TITLE#Run: }
[[ -n "$TITLE" ]] || TITLE=$(basename "$RUN_DIR")

[[ -n "$OUTPUT" ]] || OUTPUT="$RUN_DIR/steps.mp4"

# Keep the source aspect ratio, rounded to even dimensions for H.264.
src_w=$(sips -g pixelWidth "${shots[0]}" | awk '/pixelWidth/{print $2}')
src_h=$(sips -g pixelHeight "${shots[0]}" | awk '/pixelHeight/{print $2}')
even() { echo $(( ($1 + 1) / 2 * 2 )); }
H=$(even "$HEIGHT")
W=$(even "$(( src_w * H / src_h ))")

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

list="$work/frames.txt"
srt="$work/steps.srt"
: > "$list"
: > "$srt"

# SRT timestamp for a whole number of seconds.
ts() { printf '%02d:%02d:%02d,000' $(( $1 / 3600 )) $(( $1 % 3600 / 60 )) $(( $1 % 60 )); }

index=0
start=0
for shot in "${shots[@]}"; do
  index=$((index + 1))
  name=$(basename "$shot" .png)                       # step-1-vault-list
  number=$(echo "$name" | sed -n 's/^step-\([0-9]*\).*/\1/p')
  [[ -n "$number" ]] || number=$index

  if [[ ${#captions[@]} -gt 0 ]]; then
    # A caption already says what is being tested, so it stands alone: no title, no step number.
    text=${captions[$((index - 1))]//\\n/$'\n'}
    echo "  caption $index: ${text//$'\n'/ }"
  else
    label=$(echo "$name" | sed 's/^step-[0-9]*-*//' | tr '-' ' ')
    [[ -n "$label" ]] || label="Step $number"
    label="$(echo "${label:0:1}" | tr '[:lower:]' '[:upper:]')${label:1}"
    text=$(printf '%s\nStep %s: %s' "$TITLE" "$number" "$label")
    echo "  step $number: $label"
  fi

  printf "file '%s'\nduration %s\n" "$shot" "$DURATION" >> "$list"

  end=$((start + DURATION))
  printf '%d\n%s --> %s\n%s\n\n' "$index" "$(ts "$start")" "$(ts "$end")" "$text" >> "$srt"
  start=$end
done

echo "Run:    $TITLE"
echo "Frames: ${#shots[@]} x ${DURATION}s at ${W}x${H}, subtitles $([[ $SOFT -eq 1 ]] && echo soft || echo "burned in")"

fit="scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG}"

if [[ $SOFT -eq 1 ]]; then
  "$FFMPEG" -y -loglevel error -f concat -safe 0 -i "$list" -i "$srt" \
    -vf "${fit},format=yuv420p" \
    -map 0:v -map 1:s -c:v libx264 -preset medium -crf 20 -fps_mode cfr -r "$FPS" \
    -c:s mov_text -metadata:s:s:0 language=eng -metadata title="$TITLE" \
    -movflags +faststart "$OUTPUT"
else
  # Escape the filtergraph metacharacters in the subtitle path.
  srt_arg=$(printf '%s' "$srt" | sed -e 's/\\/\\\\/g' -e "s/'/\\\\'/g" -e 's/:/\\:/g')
  # libass lays subtitles out in the 384x288 default script space and scales that to the output,
  # so these sizes are in script units and stay proportional at any -H.
  style="FontName=Helvetica,Bold=1,FontSize=13,PrimaryColour=&H00FFFFFF"
  style="${style},BackColour=&HB0000000,BorderStyle=4,Outline=0,Shadow=0"
  style="${style},Alignment=2,MarginV=10,MarginL=30,MarginR=30"

  "$FFMPEG" -y -loglevel error -f concat -safe 0 -i "$list" \
    -vf "${fit},subtitles='${srt_arg}':force_style='${style}',format=yuv420p" \
    -c:v libx264 -preset medium -crf 20 -fps_mode cfr -r "$FPS" \
    -metadata title="$TITLE" -movflags +faststart "$OUTPUT"
fi

echo "Wrote:  $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
