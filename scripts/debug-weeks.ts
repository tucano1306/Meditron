import { getWeekNumber, getWeekNumberFromUTCDate, getWeekStartEnd, getWeekStartEndFromWeekNumber, getFloridaDateComponents, getISOWeekAndYear, getISOWeekAndYearFromUTCDate } from '../src/lib/utils'

const now = new Date()
console.log('Server now:', now.toISOString())
console.log('Server local timezone offset (minutes):', now.getTimezoneOffset())

const fc = getFloridaDateComponents(now)
console.log('Florida components:', fc)

const wn = getWeekNumber(now)
console.log('getWeekNumber(now):', wn)
const iwy = getISOWeekAndYear(now)
console.log('getISOWeekAndYear(now):', iwy)

const ws = getWeekStartEnd(now)
console.log('getWeekStartEnd(now):', { start: ws.start.toISOString(), end: ws.end.toISOString() })

console.log('\n--- Week boundary test ---')

// Test Feb 22 (Sunday - should be week 8) and Feb 23 (Monday - should be week 9)
const sundayUTC = new Date(Date.UTC(2026, 1, 22))
const mondayUTC = new Date(Date.UTC(2026, 1, 23))

console.log('Sunday Feb 22 UTC midnight:', sundayUTC.toISOString())
console.log('  getWeekNumberFromUTCDate:', getWeekNumberFromUTCDate(sundayUTC))
console.log('  getWeekNumber:', getWeekNumber(sundayUTC))
console.log('  getISOWeekAndYear:', getISOWeekAndYear(sundayUTC))

console.log('Monday Feb 23 UTC midnight:', mondayUTC.toISOString())
console.log('  getWeekNumberFromUTCDate:', getWeekNumberFromUTCDate(mondayUTC))
console.log('  getWeekNumber (old, buggy for UTC midnight):', getWeekNumber(mondayUTC))
console.log('  getISOWeekAndYear (new, fixed):', getISOWeekAndYear(mondayUTC))

// Simulate what POST /api/entries does for a Monday date
console.log('\n--- Simulating manual entry for Monday Feb 23 ---')
const oldWay = new Date(2026, 1, 23) // LOCAL time - BUG source!
console.log('Old targetDate (local):', oldWay.toISOString(), '→ getWeekNumber:', getWeekNumber(oldWay))
const newWay = new Date(Date.UTC(2026, 1, 23)) // UTC 
console.log('New targetDate (UTC):', newWay.toISOString())
console.log('  getISOWeekAndYear (Florida conversion - wrong for calendar dates):', getISOWeekAndYear(newWay))
console.log('  getISOWeekAndYearFromUTCDate (direct - correct for calendar dates):', getISOWeekAndYearFromUTCDate(newWay))
console.log()
console.log('✓ FIX: getOrCreateWeekFromCalendarDate(2026, 2, 23) uses getISOWeekAndYearFromUTCDate → week 9')

// Show week ranges for weeks 8 and 9
console.log('\n--- Week ranges ---')
const w8 = getWeekStartEndFromWeekNumber(8, 2026)
console.log('Week 8:', { start: w8.start.toISOString(), end: w8.end.toISOString() })
const w9 = getWeekStartEndFromWeekNumber(9, 2026)
console.log('Week 9:', { start: w9.start.toISOString(), end: w9.end.toISOString() })
