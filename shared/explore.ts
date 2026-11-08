/**
 * Curated content for the landing page and Explore.
 * `file` is the photo name in client/public/images; until it exists, `q` fetches one from Unsplash.
 */
export type Pick = { name: string; region: string; months: string; why: string; quiet?: string; tag: string; file: string; q: string; offbeat?: boolean }

export const HERO: (Pick & { tint: string; tint2: string; good: string })[] = [
  { name: "Thailand", region: "Southeast Asia", months: "Nov – Feb", why: "Cool, dry months for the islands, Bangkok and the north.", tag: "Good right now", good: "Beaches · Street food · Islands", file: "thailand-beach.jpg", q: "thailand beach longtail boat", tint: "#0F4447", tint2: "#0B2C3A" },
  { name: "Finland", region: "Lapland", months: "Dec – Mar", why: "Snow-deep forests, glass cabins and a real shot at the northern lights.", tag: "Lapland", good: "Snow · Northern lights · Saunas", file: "finland-northern-lights.jpg", q: "lapland northern lights", tint: "#0F3B2E", tint2: "#141F3D" },
  { name: "Japan", region: "East Asia", months: "Late Mar – Apr", why: "Temples, gardens and cherry trees in bloom from Tokyo to Kyoto.", tag: "Blossom season", good: "Blossoms · Gardens · Food", file: "japan-cherry-blossom.jpg", q: "kyoto cherry blossom temple", tint: "#4A1F33", tint2: "#2C1A3A" },
  { name: "Uzbekistan", region: "Silk Road", months: "Apr – May · Sep – Oct", why: "Tiled domes, old bazaars and fast trains between Samarkand and Bukhara.", tag: "Spring & autumn", good: "Architecture · Bazaars · Trains", file: "samarkand-registan.jpg", q: "samarkand registan", tint: "#1A2C52", tint2: "#3D2A14" },
  { name: "Kenya", region: "Africa", months: "Jul – Oct", why: "The Great Migration across the Masai Mara, with tented camps at dawn.", tag: "Safari season", good: "Wildlife · Safari · Sunsets", file: "kenya-masai-mara.jpg", q: "masai mara safari", tint: "#4A2C10", tint2: "#3A1A10" },
  { name: "Gandikota", region: "India", months: "Nov – Feb", why: "A red-rock gorge on the Pennar river: India's quiet canyon road trip.", tag: "Hidden gem", good: "Gorge · Fort · Camping", file: "gandikota-gorge.jpg", q: "gandikota gorge", tint: "#4A1E12", tint2: "#2E1A12", offbeat: true },
]

export const GEMS: Pick[] = [
  { name: "Gandikota", region: "India · Andhra Pradesh", months: "Nov – Feb", why: "A red-rock gorge with an old fort on the rim.", quiet: "No major airport nearby and few big hotels.", tag: "Budget-friendly", file: "gandikota-gorge.jpg", q: "gandikota gorge", offbeat: true },
  { name: "Song-Kul lake", region: "Kyrgyzstan", months: "Jun – Aug", why: "A high alpine lake with nights in herders' yurt camps.", quiet: "Open only in summer, on rough mountain roads.", tag: "Budget-friendly", file: "song-kul-lake.jpg", q: "song kul lake yurt", offbeat: true },
  { name: "Khiva", region: "Uzbekistan", months: "Apr – May, Sep – Oct", why: "A walled old town of minarets you can cross on foot.", quiet: "Far west of the usual Samarkand–Bukhara route.", tag: "Fewer crowds", file: "khiva-old-town.jpg", q: "khiva old town minaret", offbeat: true },
  { name: "Albanian Riviera", region: "Albania", months: "May – Jun, Sep", why: "Stone towns and Ionian beaches for less than the Greek islands.", quiet: "It only opened up to tourism in recent decades.", tag: "Budget-friendly", file: "albania-riviera.jpg", q: "albanian riviera ksamil", offbeat: true },
  { name: "Tusheti", region: "Georgia", months: "Jul – Sep", why: "Stone tower villages high in the Caucasus.", quiet: "One steep mountain road, open only in the warm months.", tag: "Remote", file: "tusheti-georgia.jpg", q: "tusheti georgia village", offbeat: true },
  { name: "Spiti Valley", region: "India · Himachal Pradesh", months: "Jun – Sep", why: "Cliff-top monasteries in a cold high desert.", quiet: "Long mountain drives; roads open mainly in summer.", tag: "Budget-friendly", file: "spiti-valley.jpg", q: "spiti valley key monastery", offbeat: true },
]

export type Season = { id: "winter" | "spring" | "summer" | "autumn"; name: string; months: string; tint: string; picks: Pick[] }

export const SEASONS: Season[] = [
  { id: "winter", name: "Winter", months: "Dec – Feb", tint: "#123A40", picks: [
    HERO[0], HERO[1],
    { name: "UAE", region: "Middle East", months: "Nov – Mar", why: "Warm days and cool desert nights.", tag: "Desert & city", file: "uae-desert.jpg", q: "dubai desert dunes" },
    { name: "Switzerland", region: "Europe", months: "Dec – Mar", why: "Ski season and scenic trains.", tag: "Mountains", file: "switzerland-alps.jpg", q: "swiss alps winter train" },
    { name: "Sri Lanka", region: "South Asia", months: "Dec – Mar", why: "Dry season on the south and west coasts.", tag: "Beaches", file: "sri-lanka-coast.jpg", q: "sri lanka coast" },
    GEMS[0],
    { name: "Wahiba Sands", region: "Oman", months: "Nov – Mar", why: "Desert camps and cool mountain terraces.", quiet: "Most visitors never leave Muscat.", tag: "Desert", file: "uae-desert.jpg", q: "wahiba sands oman", offbeat: true },
  ]},
  { id: "spring", name: "Spring", months: "Mar – May", tint: "#3E1C30", picks: [
    HERO[2], HERO[3],
    { name: "Kazakhstan & Kyrgyzstan", region: "Central Asia", months: "Apr – Jun", why: "Snowy peaks above green valleys.", tag: "Mountains", file: "almaty-city.jpg", q: "almaty mountains" },
    { name: "Jordan", region: "Middle East", months: "Mar – May", why: "Petra and Wadi Rum before the heat.", tag: "Desert", file: "petra-jordan.jpg", q: "petra jordan treasury" },
    { name: "Turkey", region: "Europe & Asia", months: "Apr – May", why: "Balloons over Cappadocia in mild weather.", tag: "Culture", file: "cappadocia-turkey.jpg", q: "cappadocia balloons" },
    GEMS[2],
    { name: "Kolsai Lakes", region: "Kazakhstan", months: "May – Sep", why: "Spruce-ringed mountain lakes.", quiet: "A long drive from Almaty, with few hotels.", tag: "Budget-friendly", file: "kolsai-lakes.jpg", q: "kolsai lake kazakhstan", offbeat: true },
  ]},
  { id: "summer", name: "Summer", months: "Jun – Aug", tint: "#3E2810", picks: [
    HERO[4],
    { name: "Mongolia", region: "East Asia", months: "Jun – Aug", why: "Naadam festival, open steppe and ger stays.", tag: "Open country", file: "mongolia-steppe.jpg", q: "mongolia steppe ger" },
    { name: "Bali", region: "Indonesia", months: "May – Sep", why: "Dry season for rice terraces and beaches.", tag: "Islands", file: "bali.jpg", q: "bali rice terrace" },
    { name: "Georgia", region: "Caucasus", months: "Jun – Sep", why: "Mountain villages and long hikes.", tag: "Mountains", file: "georgia-kazbegi.jpg", q: "kazbegi gergeti church" },
    GEMS[1], GEMS[5],
  ]},
  { id: "autumn", name: "Autumn", months: "Sep – Nov", tint: "#40200F", picks: [
    { name: "Japan", region: "East Asia", months: "Nov", why: "Autumn colours around Kyoto.", tag: "Culture", file: "kyoto-autumn.jpg", q: "kyoto autumn maple" },
    { name: "Nepal", region: "South Asia", months: "Oct – Nov", why: "Clear skies for Himalayan treks.", tag: "Trekking", file: "nepal-himalaya.jpg", q: "nepal himalaya trek" },
    HERO[3],
    { name: "Morocco", region: "Africa", months: "Sep – Nov", why: "Medinas and the Sahara as the heat fades.", tag: "Desert", file: "morocco-sahara.jpg", q: "sahara merzouga dunes" },
    { name: "Ziro Valley", region: "India · Arunachal Pradesh", months: "Sep – Nov", why: "Rice fields and pine hills.", quiet: "A long journey, and Indian visitors need an Inner Line Permit.", tag: "Budget-friendly", file: "ziro-valley.jpg", q: "ziro valley arunachal", offbeat: true },
    GEMS[3],
  ]},
]

/** The season for a date, used to open Explore on "now". */
export function seasonOf(d = new Date()): Season["id"] {
  const m = d.getMonth()
  return m === 11 || m <= 1 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn"
}
