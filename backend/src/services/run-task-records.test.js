import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { supabase } from '../config/supabase.js'
import {
  assertImageTaskOwnership,
  bindImageTaskOwnership,
  findImageRunContextByTask,
  syncRunStatusFromImageTask,
  syncRunStatusFromVideoTask
} from './run-task-records.js'

const mockSupabaseFrom = (handler) => mock.method(supabase, 'from', handler)

const createAuditLogQuery = ({ selectData = [], selectError = null, insertCalls = [] } = {}) => ({
  select() {
    return this
  },
  eq() {
    return this
  },
  contains() {
    return this
  },
  order() {
    return this
  },
  limit() {
    return Promise.resolve({ data: selectData, error: selectError })
  },
  insert(payload) {
    insertCalls.push(payload)
    return Promise.resolve({ error: null })
  }
})

const createWorkflowRunsQuery = ({ updateCalls = [], updateError = null } = {}) => ({
  update(payload) {
    updateCalls.push(payload)
    return this
  },
  eq() {
    return this
  },
  then(resolve, reject) {
    return Promise.resolve({ error: updateError }).then(resolve, reject)
  }
})

test('bindImageTaskOwnership stores run id, task id, and normalized model metadata', async () => {
  const insertCalls = []
  const restore = mockSupabaseFrom((table) => {
    assert.equal(table, 'audit_logs')
    return createAuditLogQuery({ insertCalls })
  })

  try {
    await bindImageTaskOwnership({
      userId: 'user_123',
      runId: 'run_123',
      taskId: 'task_123',
      model: ' gpt-image-2 '
    })
  } finally {
    restore.mock.restore()
  }

  assert.deepEqual(insertCalls, [
    {
      user_id: 'user_123',
      action: 'image.task.created',
      metadata: {
        run_id: 'run_123',
        task_id: 'task_123',
        model: 'gpt-image-2'
      }
    }
  ])
})

test('assertImageTaskOwnership rejects missing image task audit records', async () => {
  const restore = mockSupabaseFrom((table) => {
    assert.equal(table, 'audit_logs')
    return createAuditLogQuery({ selectData: [] })
  })

  try {
    await assert.rejects(
      assertImageTaskOwnership({ userId: 'user_123', taskId: 'missing_task' }),
      (error) => error.status === 404 && error.code === 'IMAGE_TASK_NOT_FOUND'
    )
  } finally {
    restore.mock.restore()
  }
})

test('findImageRunContextByTask returns run id and model from task metadata', async () => {
  const restore = mockSupabaseFrom((table) => {
    assert.equal(table, 'audit_logs')
    return createAuditLogQuery({
      selectData: [
        {
          metadata: {
            run_id: 'run_image_123',
            model: 'gpt-image-2'
          }
        }
      ]
    })
  })

  try {
    const context = await findImageRunContextByTask({
      userId: 'user_123',
      taskId: 'task_image_123'
    })

    assert.deepEqual(context, {
      runId: 'run_image_123',
      model: 'gpt-image-2'
    })
  } finally {
    restore.mock.restore()
  }
})

test('syncRunStatusFromImageTask marks failed task results with an error message', async () => {
  const updateCalls = []
  const restore = mockSupabaseFrom((table) => {
    assert.equal(table, 'workflow_runs')
    return createWorkflowRunsQuery({ updateCalls })
  })

  try {
    await syncRunStatusFromImageTask({
      userId: 'user_123',
      runId: 'run_image_123',
      taskResult: {
        status: 'failed',
        message: 'Provider failed'
      }
    })
  } finally {
    restore.mock.restore()
  }

  assert.equal(updateCalls.length, 1)
  assert.equal(updateCalls[0].status, 'failed')
  assert.equal(updateCalls[0].error_msg, 'Provider failed')
  assert.match(updateCalls[0].finished_at, /^\d{4}-\d{2}-\d{2}T/)
})

test('syncRunStatusFromVideoTask marks completed task results when a provider video URL exists', async () => {
  const updateCalls = []
  const restore = mockSupabaseFrom((table) => {
    assert.equal(table, 'workflow_runs')
    return createWorkflowRunsQuery({ updateCalls })
  })

  try {
    await syncRunStatusFromVideoTask({
      userId: 'user_123',
      runId: 'run_video_123',
      taskResult: {
        raw: {
          task_result: {
            videos: [{ url: 'https://provider.example.com/video.mp4' }]
          }
        }
      }
    })
  } finally {
    restore.mock.restore()
  }

  assert.equal(updateCalls.length, 1)
  assert.equal(updateCalls[0].status, 'completed')
  assert.equal(updateCalls[0].error_msg, null)
  assert.match(updateCalls[0].finished_at, /^\d{4}-\d{2}-\d{2}T/)
})
