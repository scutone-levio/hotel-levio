"use client"

import { useEffect } from "react"

/** Applies legacy admin primary gold on `<html>` so portaled UI matches the admin shell. */
export function AdminThemeScope() {
  useEffect(() => {
    document.documentElement.classList.add("admin-theme")
    return () => {
      document.documentElement.classList.remove("admin-theme")
    }
  }, [])

  return null
}
