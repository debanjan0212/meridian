import { useEffect, useState } from "react"
import type { Flight, Hotel, Leg, Place, PlacesResult, Search } from "@shared/types"
import type { Stop } from "@shared/route"

export type Candidate = Place & { pick: boolean }

/** Everything about the trip being planned. Kept in localStorage so a refresh or payment never loses it. */
export type Trip = {
  search: Search
  result: Omit<PlacesResult, "places"> & { places: Candidate[] }
  stops: Stop[]
  legChoice: Record<string, number>
  flightId: string | null
  dailyPerPerson: number
  booked: Record<string, boolean>
  savedId: string | null
  // Cached lookups, so reopening a trip is instant.
  flights?: Flight[]
  flightsKey?: string // the search the cached flights belong to
  hotels: Record<string, Hotel[]>
  legs: Record<string, Leg>
}

const KEY = "meridian.trip"

export function loadTrip(): Trip | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Trip) : null
  } catch {
    return null
  }
}

export function saveTrip(trip: Trip | null) {
  try {
    if (trip) localStorage.setItem(KEY, JSON.stringify(trip))
    else localStorage.removeItem(KEY)
  } catch {
    // Private mode or full storage: the trip still works for this visit.
  }
}

export function useTrip() {
  const [trip, setTrip] = useState<Trip | null>(loadTrip)
  useEffect(() => saveTrip(trip), [trip])
  return [trip, setTrip] as const
}

export function newTrip(search: Search, result: Trip["result"]): Trip {
  return {
    search,
    result,
    stops: result.places.filter((p) => p.pick).map((p) => ({ place: p, nights: p.nights, hotelId: null })),
    legChoice: {},
    flightId: null,
    dailyPerPerson: 1500,
    booked: {},
    savedId: null,
    hotels: {},
    legs: {},
  }
}
