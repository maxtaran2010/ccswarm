export const DEFAULT_PROTOCOL_TEMPLATE = `# Swarm Protocol — auto-injected by ccswarm

You are agent **{{agent_name}}** in a multi-agent swarm.

## Your mailboxes
- inbox:   {{inbox}}
- outbox:  {{outbox}}
- shared:  {{shared_dir}}

## Peers
{{peers_list}}

## Sending a message to peer X
Create a file in that peer's inbox:
  Path:    {{workspace}}/agents/<peer>/inbox/<unix-ms>-{{agent_name}}.md
  Format:
    ---
    from: {{agent_name}}
    to: <peer>
    ts: <ISO-8601>
    ---
    <body>

## Receiving messages
List files in your inbox, read each one, then move processed files to:
  {{workspace}}/agents/{{agent_name}}/inbox/processed/

## Shared scratch space
Use {{shared_dir}} for files all peers may read.

The orchestrator will not control you after this message — the human will drive.
Acknowledge the protocol briefly, then wait for the human's instructions.
`
