/**
 * Probe 6: Logistics resolution analysis.
 * Checks driver, pickup, subject accuracy from record snapshots.
 */

import { createProbeReport, createFinding, createRecommendation, accuracy } from './probeBase.js'

export function runLogisticsProbe(trajectories, members = []) {
  const findings = []

  // Filter trajectories with logistics data
  const logisticsRecords = trajectories.filter(t => {
    const r = t.recordSnapshot
    return r && (r.logistics || r.personIds?.length > 0 || r.activity)
  })

  let driverCorrect = 0
  let driverTotal = 0
  let subjectCorrect = 0
  let subjectTotal = 0
  let pickupPresent = 0
  let pickupMissing = 0
  let mergeSuccess = 0
  let mergeTotal = 0

  for (const t of logisticsRecords) {
    const r = t.recordSnapshot

    // Subject check: personIds should contain actual member IDs
    if (r.personIds && r.personIds.length > 0) {
      subjectTotal++
      const validIds = r.personIds.filter(id => members.some(m => m.id === id))
      if (validIds.length === r.personIds.length) subjectCorrect++
    }

    // Driver/logistics check
    if (r.logistics) {
      if (r.logistics.driverName || r.logistics.driverId) {
        driverTotal++
        const driverId = r.logistics.driverId
        if (driverId && members.some(m => m.id === driverId)) driverCorrect++
        else if (r.logistics.driverName && members.some(m => m.name === r.logistics.driverName)) driverCorrect++
      }

      // Pickup check
      if (r.needsPickup === false && (r.logistics.pickupById || r.logistics.pickupByName)) {
        pickupPresent++
      } else if (r.needsPickup === true) {
        pickupMissing++
      }
    }

    // Cross-segment merge check (compound with pickup)
    if (t.isCompound && r.logistics?.pickupByName) {
      mergeTotal++
      if (!r.needsPickup) mergeSuccess++ // needsPickup=false means merge happened
    }
  }

  // Findings
  if (driverTotal > 0 && accuracy(driverCorrect, driverTotal) < 80) {
    findings.push(createFinding(
      'bug', 'driver_resolution',
      `Driver resolution ${accuracy(driverCorrect, driverTotal).toFixed(1)}% — below 80%`,
      `${driverCorrect}/${driverTotal} logistics records have valid driver IDs`,
      driverTotal - driverCorrect,
      'high',
      createRecommendation('REPAIR', 'Check driver extraction for non-standard name patterns', 'src/lib/brain/entityExtractor.js', 'extractLogistics'),
    ))
  }

  if (pickupMissing > 3) {
    findings.push(createFinding(
      'warning', 'pickup_incomplete',
      `${pickupMissing} events need pickup but none assigned`,
      `Events with needsPickup=true suggest missing cross-segment merge or unresolved pickup`,
      pickupMissing,
      'medium',
    ))
  }

  // Score
  const driverScore = driverTotal > 0 ? accuracy(driverCorrect, driverTotal) : 100
  const subjectScore = subjectTotal > 0 ? accuracy(subjectCorrect, subjectTotal) : 100
  const pickupScore = (pickupPresent + pickupMissing) > 0
    ? accuracy(pickupPresent, pickupPresent + pickupMissing) : 100
  const mergeScore = mergeTotal > 0 ? accuracy(mergeSuccess, mergeTotal) : 100

  const score = driverScore * 0.3 + subjectScore * 0.3 + pickupScore * 0.2 + mergeScore * 0.2

  return createProbeReport('logistics', score, findings, {
    driverAccuracy: driverScore,
    subjectAccuracy: subjectScore,
    pickupRate: pickupScore,
    mergeRate: mergeScore,
    logisticsRecords: logisticsRecords.length,
  })
}
