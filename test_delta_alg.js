function getOverlapDelta(snapshotLines, currentLines) {
  // Strip footer (last 8 lines usually, but let's just strip lines that contain ╭─── or ╰─── and below)
  const stripFooter = (lines) => {
    let content = [...lines];
    const footerStart = content.findIndex(l => l.includes("╭───"));
    if (footerStart !== -1) {
      content = content.slice(0, footerStart);
    }
    // Also strip trailing empty lines
    while (content.length > 0 && content[content.length - 1].trim() === "") {
      content.pop();
    }
    return content;
  };

  const sContent = stripFooter(snapshotLines);
  const cContent = stripFooter(currentLines);

  // Find max overlap
  let maxOverlap = 0;
  for (let k = 1; k <= Math.min(sContent.length, cContent.length); k++) {
    const sSuffix = sContent.slice(-k).join("\n");
    const cPrefix = cContent.slice(0, k).join("\n");
    if (sSuffix === cPrefix) {
      maxOverlap = k;
    }
  }

  // The new lines are everything in cContent after the overlap
  const newLines = cContent.slice(maxOverlap);
  return newLines;
}

const s = [
  "Old line 1",
  "Old line 2",
  "Old line 3",
  "╭─────────",
  "│ footer  ",
  "╰─────────"
];

const c = [
  "Old line 2",
  "Old line 3",
  "Prompt line 1",
  "Response line 1",
  "╭─────────",
  "│ footer  ",
  "╰─────────"
];

console.log(getOverlapDelta(s, c));
