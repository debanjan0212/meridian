/** Shapes shared by the browser and the functions. */

export type Search = {
  from: string // city the traveller starts from, e.g. "Bengaluru"
  to: string // countries, a region, or "anywhere"
  start: string // YYYY-MM-DD
  nights: number
  budget: number // INR for the whole group
  adults: number
}

export type Place = {
  id: string
  name: string
  country: string
  countryCode: string // ISO-2, used for hotel search
  city: string // where you sleep; hotels are searched here
  iata: string // nearest airport
  nights: number // suggested; 0 = day trip from the previous stop
  note: string
  offbeat: boolean
  closed: string | null // e.g. "Road closed until June"
  photo: string // search words for a photo
}

export type PlacesResult = {
  title: string
  origin: { city: string; iata: string }
  places: Place[]
  tips: string[]
}

export type LegOption = { mode: string; duration: string; estInr: number | null; note: string }
export type Leg = { from: string; to: string; options: LegOption[] }

export type Flight = {
  id: string // ignav_id, used for the booking link
  price: number
  currency: string
  carrier: string
  stops: number
  minutes: number
  depart: string
  arrive: string
  backDepart: string | null
  backArrive: string | null
  backStops: number | null
}

export type Hotel = {
  id: string
  name: string
  photo: string | null
  stars: number | null
  total: number // for all nights, whole group
  currency: string
  bookUrl: string
}

export type Me = {
  email: string | null
  admin: boolean
  paymentsMode: "off" | "sandbox" | "live"
  passUntil: string | null
  canPlan: boolean
}
