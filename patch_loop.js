const fs = require('fs');
let code = fs.readFileSync('open-sse/services/freebuff/ptyWorker.js', 'utf8');

const target = `      // Unified event-driven wait loop
      const startWait = Date.now();
      let generationDone = false;
      let lastEmittedText = "";
      let hasSeenGenerating = false;

      // Small initial delay so we don't instantly read READY before the prompt is processed
      await new Promise((r) => setTimeout(r, 300));

      while (Date.now() - startWait < GENERATION_TIMEOUT_MS) {
        if (signal?.aborted) {
          this.ptyProcess.write("\\u001b");
          collector.stop();
          throw new Error("Request aborted by client");
        }

        const state = this.parser.getState();
        if (state === TUI_STATES.GENERATING) {
          hasSeenGenerating = true;
        }

        if (state === TUI_STATES.READY || state === TUI_STATES.SESSION_ENDED) {
          const elapsed = Date.now() - startWait;
          const hasOutput = collector.collectedLines.length > 0;
          
          if (hasSeenGenerating || hasOutput) {
            await new Promise((r) => setTimeout(r, 200)); // drain
            generationDone = true;
            break;
          } else if (elapsed > 8000) {
            // Waited 8 seconds, no output, still READY. Prompt was likely ignored.
            break;
          }
        }

        await new Promise((r) => setTimeout(r, 100));
      }`;

const replacement = `      // Unified event-driven wait loop
      const startWait = Date.now();
      let generationDone = false;
      let hasSeenGenerating = false;
      let lastOutputTime = Date.now();
      let lastCollectedLength = 0;

      // Small initial delay so we don't instantly read READY before the prompt is processed
      await new Promise((r) => setTimeout(r, 300));

      while (Date.now() - startWait < GENERATION_TIMEOUT_MS) {
        if (signal?.aborted) {
          this.ptyProcess.write("\\u001b");
          collector.stop();
          throw new Error("Request aborted by client");
        }

        const state = this.parser.getState();
        if (state === TUI_STATES.GENERATING) {
          hasSeenGenerating = true;
        }

        const currentLength = collector.collectedLines.length;
        if (currentLength > lastCollectedLength) {
          lastCollectedLength = currentLength;
          lastOutputTime = Date.now();
        }

        if (state === TUI_STATES.READY || state === TUI_STATES.SESSION_ENDED) {
          const elapsed = Date.now() - startWait;
          const silenceElapsed = Date.now() - lastOutputTime;
          
          if (hasSeenGenerating) {
            await new Promise((r) => setTimeout(r, 200)); // drain
            generationDone = true;
            break;
          } else if (silenceElapsed > 2500 && currentLength > 0) {
            // Fast response: No GENERATING state, but we got output and it's been silent
            await new Promise((r) => setTimeout(r, 200));
            generationDone = true;
            break;
          } else if (elapsed > 8000 && currentLength === 0) {
            // Waited 8 seconds, zero output, still READY. Prompt was ignored.
            break;
          }
        }

        await new Promise((r) => setTimeout(r, 100));
      }`;

code = code.replace(target, replacement);
fs.writeFileSync('open-sse/services/freebuff/ptyWorker.js', code);
