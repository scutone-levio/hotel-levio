"use client"

import * as React from "react"

import type { AdminPageSize } from "@/components/admin/admin-pagination"

type UsePaginatedListOptions = {
  initialPageSize?: AdminPageSize
  /** When this value changes (e.g. a filter), the page resets to 1. */
  resetKey?: unknown
}

/** Shared page/pageSize state and derived current page + slice for admin list tables. */
export function usePaginatedList<T>(
  items: T[],
  { initialPageSize = 10, resetKey }: UsePaginatedListOptions = {},
) {
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState<AdminPageSize>(initialPageSize)

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const currentPage = Math.min(Math.max(page, 1), totalPages)

  React.useEffect(() => {
    if (page !== currentPage) setPage(currentPage)
  }, [page, currentPage])

  // Reset to page 1 whenever the caller's filter/reset key changes.
  React.useEffect(() => {
    setPage(1)
  }, [resetKey])

  const paginated = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  function handlePageSizeChange(size: AdminPageSize) {
    setPageSize(size)
    setPage(1)
  }

  return {
    page,
    setPage,
    pageSize,
    currentPage,
    totalPages,
    paginated,
    handlePageSizeChange,
  }
}
