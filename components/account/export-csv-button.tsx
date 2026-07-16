"use client"

import * as React from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ExportCsvButton() {
  const [exporting, setExporting] = React.useState(false)

  function handleExport() {
    setExporting(true)
    window.location.href = "/api/export/customer/bookings"
    setTimeout(() => setExporting(false), 1000)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
    >
      <Download className="size-4" />
      {exporting ? "Exporting…" : "Export CSV"}
    </Button>
  )
}
