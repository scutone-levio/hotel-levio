import { KnowledgePanel } from "@/components/admin/knowledge-panel"

export const metadata = { title: "Policy Search — Hôtel Levio Admin" }
export const dynamic = "force-dynamic"

export default function AdminKnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl tracking-tight">Policy Search</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Ask about hotel policies and procedures. Answers are drawn only from the
          ingested policy documents, with sources cited.
        </p>
      </div>
      <KnowledgePanel />
    </div>
  )
}
