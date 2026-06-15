"use client";

import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useProject } from "@/lib/store/project";
import { fusionApi, type WorkflowRow } from "@/lib/client/fusion";
import { useFusion } from "@/components/fusion/useFusion";
import { PageHeader, LoadingState, Banner, PrimaryButton, GhostButton, Card } from "@/components/fusion/primitives";
import { Workflow, Plus, Trash2, Save, Loader2 } from "lucide-react";

const BLOCK_TYPES = ["Prompt", "Model", "Judge", "Skill", "MCP", "Output"] as const;

export default function WorkflowsPage() {
  const { activeWorkspace } = useProject();
  const ws = activeWorkspace?.id ?? "";
  const { data, loading, error, reload } = useFusion(() => fusionApi.listWorkflows(ws), [ws]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);
  const idRef = useRef(0);

  if (!ws) return <Banner kind="error">Select a workspace.</Banner>;
  const workflows: WorkflowRow[] = data?.workflows ?? [];

  const newWorkflow = () => { setEditingId("new"); setName("Untitled workflow"); setNodes([]); setEdges([]); };

  const load = (w: WorkflowRow) => {
    setEditingId(w.id);
    setName(w.name);
    setNodes((w.graph?.nodes as Node[]) ?? []);
    setEdges((w.graph?.edges as Edge[]) ?? []);
  };

  const addNode = (type: string) => {
    const id = `${type}-${idRef.current++}`;
    const prev = nodes[nodes.length - 1];
    const node: Node = {
      id,
      position: { x: 80 + nodes.length * 40, y: 60 + nodes.length * 80 },
      data: { label: type },
      type: "default",
    };
    setNodes((ns) => [...ns, node]);
    if (prev) setEdges((es) => addEdge({ source: prev.id, target: id, id: `${prev.id}-${id}` }, es));
  };

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const graph = { nodes, edges };
      if (editingId && editingId !== "new") await fusionApi.updateWorkflow(ws, editingId, { name, graph });
      else { const r = await fusionApi.createWorkflow(ws, { name, graph }); setEditingId(r.item.id); }
      reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  const remove = async (w: WorkflowRow) => { await fusionApi.deleteWorkflow(ws, w.id); if (editingId === w.id) setEditingId(null); reload(); };

  return (
    <div>
      <PageHeader title="Workflows" description="Compose orchestration pipelines: Prompt → Model → Judge → Skill → MCP → Output."
        action={<PrimaryButton onClick={newWorkflow}><Plus size={16} /> New Workflow</PrimaryButton>} />
      {err && <Banner kind="error">{err}</Banner>}

      {editingId && (
        <Card className="mb-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-slate-200 bg-transparent px-3 py-1.5 text-sm dark:border-slate-800" />
            <div className="flex flex-wrap gap-1.5">
              {BLOCK_TYPES.map((t) => <GhostButton key={t} onClick={() => addNode(t)}><Plus size={12} /> {t}</GhostButton>)}
            </div>
            <PrimaryButton className="ml-auto" onClick={() => void save()} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</PrimaryButton>
          </div>
          <div className="h-[420px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </Card>
      )}

      {loading ? <LoadingState /> : error ? <Banner kind="error">{error}</Banner> : workflows.length === 0 && !editingId ? (
        <Card><p className="py-8 text-center text-sm text-slate-400">No workflows yet. Create one to build a pipeline.</p></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((w) => (
            <Card key={w.id}>
              <div className="flex items-start justify-between">
                <button onClick={() => load(w)} className="text-left">
                  <div className="flex items-center gap-2 font-semibold"><Workflow size={15} /> {w.name}</div>
                  <div className="text-xs text-slate-400">{(w.graph?.nodes?.length ?? 0)} nodes</div>
                </button>
                <button onClick={() => void remove(w)} className="rounded p-1 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
