import { supabase } from '../config/supabase.js'
import { cleanupCanvas3DAssets } from '../services/canvas3d-cleanup.service.js'

const parseArgs = (argv = []) => {
  const args = {
    dryRun: false,
    limit: 200
  }

  argv.forEach((arg) => {
    if (arg === '--dry-run') {
      args.dryRun = true
      return
    }
    if (arg === '--help' || arg === '-h') {
      args.help = true
      return
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=')[1] || 0)
      if (Number.isFinite(value) && value > 0) {
        args.limit = Math.floor(value)
      }
    }
  })

  return args
}

const cleanupTable = async ({ table, idField = 'id', limit = 200, dryRun = false }) => {
  const totals = {
    rowsScanned: 0,
    rowsChanged: 0,
    nodesVisited: 0,
    nodesChanged: 0,
    persistedUrls: 0,
    droppedExpiredUrls: 0
  }

  let from = 0

  while (true) {
    const to = from + limit - 1
    const { data, error } = await supabase
      .from(table)
      .select(`${idField}, canvas_json`)
      .range(from, to)

    if (error) {
      throw error
    }

    const rows = Array.isArray(data) ? data : []
    if (!rows.length) break

    for (const row of rows) {
      totals.rowsScanned += 1
      const result = await cleanupCanvas3DAssets(row.canvas_json || {}, { persistRemote: true })
      totals.nodesVisited += result.stats.nodesVisited
      totals.nodesChanged += result.stats.nodesChanged
      totals.persistedUrls += result.stats.persistedUrls
      totals.droppedExpiredUrls += result.stats.droppedExpiredUrls

      if (!result.changed) continue
      totals.rowsChanged += 1

      if (dryRun) continue

      const { error: updateError } = await supabase
        .from(table)
        .update({
          canvas_json: result.canvasData,
          updated_at: new Date().toISOString()
        })
        .eq(idField, row[idField])

      if (updateError) {
        throw updateError
      }
    }

    if (rows.length < limit) break
    from += rows.length
  }

  return totals
}

const printUsage = () => {
  console.log('Usage: node src/scripts/cleanup-3d-assets.js [--dry-run] [--limit=200]')
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  const projectTotals = await cleanupTable({
    table: 'projects',
    limit: args.limit,
    dryRun: args.dryRun
  })

  const templateTotals = await cleanupTable({
    table: 'shared_project_templates',
    limit: args.limit,
    dryRun: args.dryRun
  })

  console.log(JSON.stringify({
    dryRun: args.dryRun,
    projects: projectTotals,
    sharedProjectTemplates: templateTotals
  }, null, 2))
}

main().catch((error) => {
  console.error('[cleanup-3d-assets] failed', error)
  process.exitCode = 1
})
