"use client"

import * as React from "react"

import type { GraphInsights } from "@/lib/graph-insights"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Props = {
  insights: GraphInsights
}

export function InsightsDashboard({ insights }: Props) {
  const typeNames = insights.inventoryByType.map((row) => row.typeName)
  const [activeType, setActiveType] = React.useState(typeNames[0] ?? "")

  const statCards = [
    { label: "Room types", value: String(insights.nodeCounts.roomTypes) },
    { label: "Rooms", value: String(insights.nodeCounts.rooms) },
    { label: "Bookings", value: String(insights.nodeCounts.bookings) },
    {
      label: "Subcategory linked",
      value: `${insights.roomsWithSubcategoryPct}%`,
      accent: true,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border bg-card p-4 ${card.accent ? "border-primary/60" : ""}`}
          >
            <p
              className={`mb-2 text-[10px] font-semibold uppercase tracking-wider ${
                card.accent ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {card.label}
            </p>
            <p
              className={`text-2xl font-bold tabular-nums ${
                card.accent ? "text-primary" : ""
              }`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-lg">Inventory by room type</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium text-right">Rooms</th>
                  <th className="px-2 py-2 font-medium text-right">
                    With subcategory
                  </th>
                </tr>
              </thead>
              <tbody>
                {insights.inventoryByType.map((row) => (
                  <tr key={row.typeSlug} className="border-t">
                    <td className="px-2 py-2">{row.typeName}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.roomCount}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {row.subcategoryLinked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-lg">Top amenities by room reach</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="px-2 py-2 font-medium">Amenity</th>
                  <th className="px-2 py-2 font-medium">Category</th>
                  <th className="px-2 py-2 font-medium text-right">Rooms</th>
                </tr>
              </thead>
              <tbody>
                {insights.topAmenities.length ? (
                  insights.topAmenities.map((row) => (
                    <tr key={row.amenityName} className="border-t">
                      <td className="px-2 py-2">{row.amenityName}</td>
                      <td className="text-muted-foreground px-2 py-2">
                        {row.category ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {row.roomCount}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="text-muted-foreground px-2 py-6 text-center"
                    >
                      No amenity relationships in graph.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-lg">Bookings by room type</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium text-right">Confirmed</th>
                <th className="px-2 py-2 font-medium text-right">Pending</th>
                <th className="px-2 py-2 font-medium text-right">Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {insights.bookingsByType.map((row) => (
                <tr key={row.typeName} className="border-t">
                  <td className="px-2 py-2">{row.typeName}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {row.confirmed}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {row.pending}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {row.cancelled}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          {insights.pendingBookings} pending booking(s) across all types.
        </p>
      </section>

      {typeNames.length ? (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-lg">Relationship samples</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Room type → subcategory → room → amenity paths from the graph.
          </p>
          <Tabs
            value={activeType}
            onValueChange={setActiveType}
          >
            <TabsList className="border bg-white p-0.5">
              {typeNames.map((name) => (
                <TabsTrigger
                  key={name}
                  value={name}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {name}
                </TabsTrigger>
              ))}
            </TabsList>
            {typeNames.map((name) => {
              const rows = insights.roomRelationships.filter(
                (row) => row.typeName === name,
              )
              return (
              <TabsContent key={name} value={name} className="mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-muted-foreground text-xs uppercase">
                      <tr>
                        <th className="px-2 py-2 font-medium">Room #</th>
                        <th className="px-2 py-2 font-medium">Subcategory</th>
                        <th className="px-2 py-2 font-medium">Amenities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length ? (
                        rows.map((row) => (
                          <tr
                            key={`${row.roomNumber}-${row.subcategoryName ?? "none"}`}
                            className="border-t"
                          >
                            <td className="px-2 py-2">{row.roomNumber}</td>
                            <td className="px-2 py-2">
                              {row.subcategoryName ?? "—"}
                            </td>
                            <td className="px-2 py-2">
                              {row.amenityNames.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {row.amenityNames.map((amenity) => (
                                    <Badge key={amenity} variant="secondary">
                                      {amenity}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={3}
                            className="text-muted-foreground px-2 py-6 text-center"
                          >
                            No rooms for this type.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              )
            })}
          </Tabs>
        </section>
      ) : null}
    </div>
  )
}
