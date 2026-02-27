/**
 * Notifier utility | 通知工具
 * Wraps window.$message to provide consistent notification interface
 */

export const notifier = {
  success: (msg) => {
    if (window.$message) {
      window.$message.success(msg)
    } else {
      console.log('[Notifier Success]', msg)
    }
  },
  
  warning: (msg) => {
    if (window.$message) {
      window.$message.warning(msg)
    } else {
      console.warn('[Notifier Warning]', msg)
    }
  },
  
  error: (msg) => {
    if (window.$message) {
      window.$message.error(msg)
    } else {
      console.error('[Notifier Error]', msg)
    }
  },
  
  info: (msg) => {
    if (window.$message) {
      window.$message.info(msg)
    } else {
      console.log('[Notifier Info]', msg)
    }
  }
}

export default notifier
