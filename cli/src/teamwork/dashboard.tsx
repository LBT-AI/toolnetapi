import { createSignal, For } from "solid-js";

export function TeamworkDashboard() {
  const [agents, setAgents] = createSignal([
    { name: "Explorer", status: "Done" },
    { name: "Developer", status: "Running..." },
    { name: "QA", status: "Waiting..." },
    { name: "Merge", status: "Pending" }
  ]);
  
  const [progress, setProgress] = createSignal(81);
  const [duration, setDuration] = createSignal("3m12s");
  const [tokens, setTokens] = createSignal("28k");
  const [costSaved, setCostSaved] = createSignal("61%");

  return (
    <box flexDirection="column" padding={1} borderStyle="rounded" borderColor="cyan">
      <text fg="green">ToolNet Teamwork v2 Live Dashboard</text>
      
      <box marginY={1}>
        <text>Project Progress: </text>
        <text fg="cyan">{`[${'#'.repeat(Math.floor(progress() / 10))}${' '.repeat(10 - Math.floor(progress() / 10))}] ${progress()}%`}</text>
      </box>

      <box flexDirection="column" borderStyle="single" padding={1}>
        <text>Agent Status:</text>
        <For each={agents()}>{a => (
          <text>
             {a.name}: <text fg={a.status === 'Done' ? 'green' : a.status.includes('Running') ? 'yellow' : 'gray'}>{a.status}</text>
          </text>
        )}</For>
      </box>

      <box marginTop={1} justifyContent="space-between">
        <text>Duration: <text fg="yellow">{duration()}</text></text>
        <text>Tokens: <text fg="magenta">{tokens()}</text></text>
        <text>Cost Saved: <text fg="green">{costSaved()}</text></text>
      </box>
    </box>
  );
}
